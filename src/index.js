#!/usr/bin/env node

import inquirer from "inquirer";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prefixes from "./data/prefixes.js";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Constants
const MAX_COMMIT_LENGTH = 70;
const MIN_MESSAGE_LENGTH = 10;
const CONFIG_DIR = path.join(os.homedir(), ".gitcopus");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const COLORS = {
    SUCCESS: "\x1b[32m",
    WARNING: "\x1b[33m",
    RESET: "\x1b[0m",
};

// Configuration
dotenv.config();

// Utilities
const exec = promisify(execCallback);
const logger = {
    success: (msg) => console.log(`${COLORS.SUCCESS}${msg}${COLORS.RESET}`),
    warning: (msg) => console.log(`${COLORS.WARNING}${msg}${COLORS.RESET}`),
    error: (msg) => console.error(msg),
};

// Menu choices for the CLI
const MENU_CHOICES = {
    GENERATE: "generate",
    MANUAL: "manual",
    EXIT: "exit",
};

// Post-commit action choices
const POST_COMMIT_ACTIONS = {
    PUSH: "push",
    STATUS: "status",
    LOG: "log",
    EXIT: "exit",
};

/**
 * Ensures the config directory exists
 * @returns {Promise<void>}
 */
async function ensureConfigDir() {
    try {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
    } catch (error) {
        throw new Error(`Failed to create config directory: ${error.message}`);
    }
}

/**
 * Reads the stored API key
 * @returns {Promise<string|null>}
 */
async function readApiKey() {
    try {
        const config = await fs.readFile(CONFIG_FILE, "utf8");
        return JSON.parse(config).apiKey;
    } catch (error) {
        return null;
    }
}

/**
 * Stores the API key
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
async function storeApiKey(apiKey) {
    try {
        await ensureConfigDir();
        await fs.writeFile(CONFIG_FILE, JSON.stringify({ apiKey }));
    } catch (error) {
        throw new Error(`Failed to store API key: ${error.message}`);
    }
}

/**
 * Prompts for API key
 * @returns {Promise<string>}
 */
async function promptForApiKey() {
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

/**
 * Initializes the AI client
 * @returns {Promise<GoogleGenerativeAI>}
 */
async function initializeAI() {
    let apiKey = await readApiKey();

    if (!apiKey) {
        logger.warning("No API key found. Please enter your Gemini API key.");
        logger.warning("You can get an API key from: https://makersuite.google.com/app/apikey");
        apiKey = await promptForApiKey();
        await storeApiKey(apiKey);
        logger.success("API key stored successfully!");
    }

    return new GoogleGenerativeAI(apiKey);
}

/**
 * Shows the initial menu with commit message options
 * @returns {Promise<string>}
 */
async function showInitialMenu() {
    try {
        const { choice } = await inquirer.prompt({
            type: "list",
            name: "choice",
            message: "How would you like to create your commit message?",
            choices: [
                { name: "Generate commit message", value: MENU_CHOICES.GENERATE },
                { name: "Custom commit message", value: MENU_CHOICES.MANUAL },
                { name: "Exit", value: MENU_CHOICES.EXIT },
            ],
        });
        return choice;
    } catch (error) {
        throw new Error(`Menu error: ${error.message}`);
    }
}

/**
 * Gets the current git diff for staged changes
 * @returns {Promise<string>}
 */
async function getGitDiff() {
    try {
        const { stdout } = await exec("git diff --cached");
        return stdout;
    } catch (error) {
        throw new Error(`Git diff error: ${error.message}`);
    }
}

/**
 * Generates AI-powered commit message
 * @param {string} diff - Git diff content
 * @param {GoogleGenerativeAI} genAI - AI instance
 * @returns {Promise<string>}
 */
async function generateAICommitMessage(diff, genAI) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Generate a conventional commit message for this git diff. STRICT REQUIREMENTS:
            - Maximum ${MAX_COMMIT_LENGTH} characters total
            - Include type prefix (feat, fix, etc.)
            - Be specific and concise reporting all the main changes
            Diff: ${diff}
            Return ONLY the commit message.`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim().slice(0, MAX_COMMIT_LENGTH);
    } catch (error) {
        throw new Error(`AI generation error: ${error.message}`);
    }
}

/**
 * Gets manual commit message from user
 * @returns {Promise<string>}
 */
async function getManualCommitMessage() {
    try {
        const { prefix } = await inquirer.prompt({
            type: "list",
            name: "prefix",
            message: "Select commit type:",
            choices: prefixes.map((p) => ({
                name: `${p.name}: ${p.description}`,
                value: p.name,
            })),
        });

        const remainingLength = MAX_COMMIT_LENGTH - (prefix.length + 2);

        const { message } = await inquirer.prompt({
            type: "input",
            name: "message",
            message: `Enter commit message (max ${remainingLength} chars):`,
            validate: (input) => {
                if (input.length < MIN_MESSAGE_LENGTH) {
                    return `Message must be at least ${MIN_MESSAGE_LENGTH} characters.`;
                }
                if (input.length > remainingLength) {
                    return `Message too long. Maximum ${remainingLength} characters allowed.`;
                }
                return true;
            },
        });

        return `${prefix}: ${message}`;
    } catch (error) {
        throw new Error(`Manual commit error: ${error.message}`);
    }
}

/**
 * Predicts commit message using AI
 * @param {string} diff - Git diff content
 * @param {GoogleGenerativeAI} genAI - AI instance
 * @returns {Promise<string>}
 */

async function predictCommitMessage(diff, genAI) {
    try {
        const prediction = await generateAICommitMessage(diff, genAI);

        const { useMessage } = await inquirer.prompt({
            type: "confirm",
            name: "useMessage",
            message: `AI suggests: "${prediction}"\n\nUse this message?`,
            default: true,
        });

        return useMessage ? prediction : null;
    } catch (error) {
        logger.warning("Commit message generation failed, returning to main menu");
        return null;
    }
}

/**
 * Executes a git command
 * @param {string} command - Git command to execute
 * @returns {Promise<void>}
 */
async function executeGitCommand(command) {
    try {
        const { stdout, stderr } = await exec(command);
        if (stderr) logger.warning(stderr);
        if (stdout) logger.success(stdout);
    } catch (error) {
        throw new Error(`Git command error: ${error.message}`);
    }
}

/**
 * Handles post-commit actions
 * @returns {Promise<void>}
 */
async function handlePostCommit() {
    try {
        const { action } = await inquirer.prompt({
            type: "list",
            name: "action",
            message: "What would you like to do next?",
            choices: [
                { name: "Push changes", value: POST_COMMIT_ACTIONS.PUSH },
                { name: "View status", value: POST_COMMIT_ACTIONS.STATUS },
                { name: "View log", value: POST_COMMIT_ACTIONS.LOG },
                { name: "Exit", value: POST_COMMIT_ACTIONS.EXIT },
            ],
        });

        switch (action) {
            case POST_COMMIT_ACTIONS.PUSH:
                await executeGitCommand("git push");
                logger.success("Changes pushed successfully!");
                break;
            case POST_COMMIT_ACTIONS.STATUS:
                await executeGitCommand("git status");
                await handlePostCommit();
                break;
            case POST_COMMIT_ACTIONS.LOG:
                await executeGitCommand("git log -1");
                await handlePostCommit();
                break;
            case POST_COMMIT_ACTIONS.EXIT:
                logger.warning("Process terminated!");
                break;
        }
    } catch (error) {
        throw new Error(`Post-commit error: ${error.message}`);
    }
}

/**
 * Main function
 * @returns {Promise<void>}
 */
async function main() {
    try {
        // Initialize AI with stored or new API key
        const genAI = await initializeAI();

        const diff = await getGitDiff();

        if (!diff) {
            logger.warning("No staged changes found. Stage changes with 'git add'");
            return;
        }

        while (true) {
            // Add loop to handle menu returns
            const choice = await showInitialMenu();

            if (choice === MENU_CHOICES.EXIT) {
                logger.warning("Process terminated!");
                return;
            }

            let commitMessage = null;

            if (choice === MENU_CHOICES.GENERATE) {
                commitMessage = await predictCommitMessage(diff, genAI);
                if (!commitMessage) {
                    continue; // Return to menu if AI generation fails or user rejects
                }
            } else {
                commitMessage = await getManualCommitMessage();
            }

            const { confirmCommit } = await inquirer.prompt({
                type: "confirm",
                name: "confirmCommit",
                message: `Commit with message: "${commitMessage}"?`,
                default: true,
            });

            if (!confirmCommit) {
                continue; // Return to menu if user doesn't confirm
            }

            await executeGitCommand(`git commit -m "${commitMessage}"`);
            logger.success("Changes committed successfully!");

            await handlePostCommit();
            return; // Exit after successful commit
        }
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Error handling for unhandled rejections
process.on("unhandledRejection", (error) => {
    logger.error(`Unhandled rejection: ${error.message}`);
    process.exit(1);
});

main();
