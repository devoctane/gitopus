#!/usr/bin/env node

import inquirer from "inquirer";
import dotenv from "dotenv";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import prefixes from "./data/prefixes.js";
import { Config } from "./config/config.js";
import { APIError, GitError } from "./error/error.js";
import AIOperations from "./services/CommitGen.js";
import { logger } from "./utils/logger.js";

dotenv.config();
const exec = promisify(execCallback);

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
                { name: "Custom commit message", value: "manual" },
                { name: "Generate commit message", value: "generate" },
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
