#!/usr/bin/env node

import inquirer from "inquirer";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { existsSync } from "fs";

// Load environment variables
dotenv.config()

// Constants and Configurations
const DEFAULT_CONFIG = {
    maxCommitLength: 70,
    minMessageLength: 4,
    apiTimeout: 10000,
    maxRetries: 3,
    retryDelay: 1000,
    configVersion: "1.0.0",
};

const COLORS = {
    SUCCESS: "\x1b[32m",
    WARNING: "\x1b[33m",
    ERROR: "\x1b[31m",
    RESET: "\x1b[0m",
};

// Commit message prefixes
const prefixes = [
    { name: "feat", description: "A new feature" },
    { name: "fix", description: "A bug fix" },
    { name: "docs", description: "Documentation changes" },
    { name: "style", description: "Code style changes (formatting, etc)" },
    { name: "refactor", description: "Code refactoring" },
    { name: "test", description: "Adding or updating tests" },
    { name: "chore", description: "Maintenance tasks" },
];

// Utility Functions
const exec = promisify(execCallback);
const logger = {
    success: (msg) => console.log(`${COLORS.SUCCESS}${msg}${COLORS.RESET}`),
    warning: (msg) => console.log(`${COLORS.WARNING}${msg}${COLORS.RESET}`),
    error: (msg) => console.error(`${COLORS.ERROR}${msg}${COLORS.RESET}`),
};

// Custom Error Classes
class GitError extends Error {
    constructor(message) {
        super(message);
        this.name = "GitError";
    }
}

class APIError extends Error {
    constructor(message, isRateLimit = false) {
        super(message);
        this.name = "APIError";
        this.isRateLimit = isRateLimit;
    }
}

// Configuration Management
class Config {
    static CONFIG_DIR = path.join(os.homedir(), ".gitopus");
    static CONFIG_FILE = path.join(this.CONFIG_DIR, "config.json");

    static getEncryptionKey() {
        const baseKey = process.env.ENCRYPTION_KEY || "default-secure-key-123";
        return crypto.createHash("sha256").update(baseKey).digest();
    }

    static encrypt(text) {
        try {
            const iv = crypto.randomBytes(16);
            const key = this.getEncryptionKey();
            const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

            const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

            const authTag = cipher.getAuthTag();

            return Buffer.concat([iv, authTag, encrypted]).toString("base64");
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    static decrypt(encryptedData) {
        try {
            const buffer = Buffer.from(encryptedData, "base64");

            const iv = buffer.slice(0, 16);
            const authTag = buffer.slice(16, 32);
            const encrypted = buffer.slice(32);

            const key = this.getEncryptionKey();
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(authTag);

            return decipher.update(encrypted) + decipher.final("utf8");
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    static async load() {
        try {
            await fs.mkdir(this.CONFIG_DIR, { recursive: true });

            if (!existsSync(this.CONFIG_FILE)) {
                await fs.writeFile(this.CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG));
                return { ...DEFAULT_CONFIG };
            }

            const config = JSON.parse(await fs.readFile(this.CONFIG_FILE, "utf8"));
            return { ...DEFAULT_CONFIG, ...config };
        } catch (error) {
            throw new Error(`Configuration error: ${error.message}`);
        }
    }

    static async save(config) {
        try {
            await fs.writeFile(this.CONFIG_FILE, JSON.stringify(config, null, 2));
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error.message}`);
        }
    }
}

// Git Operations
class GitOperations {
    static async checkRepository() {
        try {
            await exec("git rev-parse --is-inside-work-tree");
            return true;
        } catch (error) {
            throw new GitError("Not a git repository");
        }
    }

    static async getDiff() {
        try {
            const { stdout } = await exec("git diff --cached");
            if (!stdout.trim()) {
                throw new GitError("No staged changes found");
            }
            return stdout;
        } catch (error) {
            if (error instanceof GitError) throw error;
            throw new GitError(`Failed to get git diff: ${error.message}`);
        }
    }

    static async commit(message) {
        try {
            await exec(`git commit -m "${message}"`);
        } catch (error) {
            throw new GitError(`Commit failed: ${error.message}`);
        }
    }

    static async push() {
        try {
            await exec("git push");
        } catch (error) {
            throw new GitError(`Push failed: ${error.message}`);
        }
    }
}

// AI Operations
class AIOperations {
    constructor(apiKey, config) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.config = config;
    }

    async generateCommitMessage(diff) {
        let attempts = 0;
        while (attempts < this.config.maxRetries) {
            try {
                const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
                const prompt = this._buildPrompt(diff);

                const result = await Promise.race([
                    model.generateContent(prompt),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("API Timeout")), this.config.apiTimeout)),
                ]);

                return this._parseMessages(result.response.text());
            } catch (error) {
                attempts++;
                if (error.message.includes("quota")) {
                    throw new APIError("API rate limit exceeded", true);
                }
                if (attempts === this.config.maxRetries) {
                    throw new APIError(`AI generation failed after ${attempts} attempts: ${error.message}`);
                }
                await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
            }
        }
    }

    _buildPrompt(diff) {
        return `Generate a conventional commit message for this git diff. 
            STRICT REQUIREMENTS:
                - Strictly evaluate the contents of the 'Diff' given below
                - Maximum ${this.config.maxCommitLength} characters total
                - Include type suitable short prefix in lowercase (feat, fix, refactor, test,docs, style, chore etc.)
                - Return exactly 1 prompt reporting all the main changes separated by commas (1., 2., etc.)
                
            Diff: ${diff}
            Return ONLY the numbered commit messages.`;
    }

    _parseMessages(text) {
        return text
            .split(/\d+\.\s+/)
            .slice(1)
            .map((msg) => msg.trim())
            .filter((msg) => msg.length > 0 && msg.length <= this.config.maxCommitLength);
    }
}

// Main Application
class Gitopus {
    constructor() {
        this.config = null;
        this.aiOps = null;
    }

    async initialize() {
        try {
            await GitOperations.checkRepository();
            this.config = await Config.load();

            const apiKey = await this._getApiKey();
            this.aiOps = new AIOperations(apiKey, this.config);
        } catch (error) {
            if (error instanceof GitError) {
                logger.error(error.message);
                process.exit(1);
            }
            throw error;
        }
    }

    async _getApiKey() {
        try {
            let apiKey = await this._readApiKey();
            if (!apiKey) {
                logger.warning("No API key found. Please enter your Gemini API key.");
                logger.warning("Get an API key from: https://makersuite.google.com/app/apikey");
                apiKey = await this._promptForApiKey();
                await this._storeApiKey(apiKey);
            }
            return apiKey;
        } catch (error) {
            throw new Error(`API key operation failed: ${error.message}`);
        }
    }

    async _promptForApiKey() {
        const { apiKey } = await inquirer.prompt({
            type: "input",
            name: "apiKey",
            message: "Please enter your Gemini API key:",
            validate: (input) => {
                if (!input.trim()) {
                    return "API key cannot be empty";
                }
                return true;
            },
        });
        return apiKey.trim();
    }

    async _readApiKey() {
        try {
            const config = await Config.load();
            return config.apiKey ? Config.decrypt(config.apiKey) : null;
        } catch (error) {
            logger.warning("Stored API key is invalid or corrupted. Please enter it again.");
            return null;
        }
    }

    async _storeApiKey(apiKey) {
        try {
            const encrypted = Config.encrypt(apiKey);
            const config = await Config.load();
            config.apiKey = encrypted;
            await Config.save(config);
            logger.success("API key stored successfully!");
        } catch (error) {
            throw new Error(`Failed to store API key: ${error.message}`);
        }
    }

    async _showMenu() {
        const { choice } = await inquirer.prompt({
            type: "list",
            name: "choice",
            message: "How would you like to create your commit message?",
            choices: [
                { name: "Generate commit message", value: "generate" },
                { name: "Custom commit message", value: "manual" },
                { name: "Exit", value: "exit" },
            ],
        });
        return choice;
    }

    async _handleChoice(choice, diff) {
        try {
            if (choice === "generate") {
                return await this._handleGenerateChoice(diff);
            } else if (choice === "manual") {
                return await this._handleManualChoice();
            }
            return null;
        } catch (error) {
            this._handleError(error);
            return null;
        }
    }

    async _handleGenerateChoice(diff) {
        try {
            const messages = await this.aiOps.generateCommitMessage(diff);
            if (!messages || messages.length === 0) {
                logger.warning("No valid commit messages generated");
                return null;
            }

            const { selectedMessage } = await inquirer.prompt({
                type: "list",
                name: "selectedMessage",
                message: "Select a commit message:",
                choices: [
                    ...messages.map((msg, index) => ({
                        name: `${index + 1}. ${msg}`,
                        value: msg,
                    })),
                    new inquirer.Separator(),
                    { name: "Return to menu", value: null },
                ],
                pageSize: 7,
            });

            if (!selectedMessage) return null;

            return await this._editMessageIfRequested(selectedMessage);
        } catch (error) {
            this._handleError(error);
            return null;
        }
    }

    async _handleManualChoice() {
        try {
            const { prefix } = await inquirer.prompt({
                type: "list",
                name: "prefix",
                message: "Select commit type:",
                choices: [
                    ...prefixes.map((p) => ({
                        name: `${p.name}: ${p.description}`,
                        value: p.name,
                    })),
                    { name: "exit", value: "exit" },
                    new inquirer.Separator(),
                ],
            });

            if (prefix === "exit") {
                logger.warning("Process terminated!");
                return null;
            }

            const remainingLength = this.config.maxCommitLength - (prefix.length + 2);
            const { message } = await inquirer.prompt({
                type: "input",
                name: "message",
                message: `Enter commit message (max ${remainingLength} chars):`,
                validate: (input) => {
                    if (input.length < this.config.minMessageLength) {
                        return `Message must be at least ${this.config.minMessageLength} characters.`;
                    }
                    if (input.length > remainingLength) {
                        return `Message too long. Maximum ${remainingLength} characters allowed.`;
                    }
                    return true;
                },
            });

            return `${prefix}: ${message}`;
        } catch (error) {
            this._handleError(error);
            return null;
        }
    }

    async _editMessageIfRequested(message) {
        const { editMessage } = await inquirer.prompt({
            type: "confirm",
            name: "editMessage",
            message: "Would you like to edit this message?",
            default: false,
        });

        if (!editMessage) return message;

        const { customMessage } = await inquirer.prompt({
            type: "input",
            name: "customMessage",
            message: "Edit commit message:",
            default: message,
            validate: (input) => {
                if (input.length < this.config.minMessageLength) {
                    return `Message must be at least ${this.config.minMessageLength} characters.`;
                }
                if (input.length > this.config.maxCommitLength) {
                    return `Message too long. Maximum ${this.config.maxCommitLength} characters allowed.`;
                }
                return true;
            },
        });

        return customMessage;
    }

    async _confirmCommit(message) {
        const { confirmCommit } = await inquirer.prompt({
            type: "confirm",
            name: "confirmCommit",
            message: `Commit with message: "${message}"?`,
            default: true,
        });
        return confirmCommit;
    }

    async _handlePostCommit() {
        try {
            const { action } = await inquirer.prompt({
                type: "list",
                name: "action",
                message: "What would you like to do next?",
                choices: [
                    { name: "Push changes", value: "push" },
                    { name: "View status", value: "status" },
                    { name: "View log", value: "log" },
                    { name: "Exit", value: "exit" },
                ],
            });

            switch (action) {
                case "push":
                    await GitOperations.push();
                    logger.success("Changes pushed successfully!");
                    break;
                case "status":
                    const { stdout: status } = await exec("git status");
                    console.log(status);
                    await this._handlePostCommit();
                    break;
                case "log":
                    const { stdout: log } = await exec("git log -1");
                    console.log(log);
                    await this._handlePostCommit();
                    break;
                case "exit":
                    logger.warning("Process terminated!");
                    break;
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    _handleError(error) {
        if (error instanceof GitError) {
            logger.error(`Git Error: ${error.message}`);
        } else if (error instanceof APIError) {
            if (error.isRateLimit) {
                logger.error("API rate limit exceeded. Please try again later.");
            } else {
                logger.error(`API Error: ${error.message}`);
            }
        } else {
            logger.error(`Error: ${error.message}`);
        }
    }

    async run() {
        try {
            await this.initialize();
            const diff = await GitOperations.getDiff();

            while (true) {
                const choice = await this._showMenu();
                if (choice === "exit") {
                    logger.warning("Process terminated!");
                    break;
                }

                const message = await this._handleChoice(choice, diff);
                if (!message) continue;

                if (await this._confirmCommit(message)) {
                    await GitOperations.commit(message);
                    logger.success("Changes committed successfully!");
                    await this._handlePostCommit();
                    break;
                }
            }
        } catch (error) {
            this._handleError(error);
        }
    }
}

// Error handling for unhandled rejections
process.on("unhandledRejection", (error) => {
    logger.error(`Unhandled rejection: ${error.message}`);
    process.exit(1);
});

// Start the application
const app = new Gitopus();
app.run();
