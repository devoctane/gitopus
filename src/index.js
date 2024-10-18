#!/usr/bin/env node

import inquirer from "inquirer";
import { promisify } from "util";
import { exec as execCallback } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prefixes from "./data/prefixes.js";
import dotenv from "dotenv";

// Constants
const MAX_COMMIT_LENGTH = 65;
const MIN_MESSAGE_LENGTH = 10;
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

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Menu choices for the CLI
 * @type {Object}
 */
const MENU_CHOICES = {
    GENERATE: "generate",
    MANUAL: "manual",
    EXIT: "exit",
};

/**
 * Post-commit action choices
 * @type {Object}
 */
const POST_COMMIT_ACTIONS = {
    PUSH: "push",
    STATUS: "status",
    LOG: "log",
    EXIT: "exit",
};

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
 * @returns {Promise<string>}
 */
async function generateAICommitMessage(diff) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Generate a conventional commit message for this git diff. STRICT REQUIREMENTS:
            - Maximum ${MAX_COMMIT_LENGTH} characters total
            - Include type prefix (feat, fix, etc.)
            - Be specific but concise
            - Focus on the main change
            Diff: ${diff}
            Return ONLY the commit message.`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim().slice(0, MAX_COMMIT_LENGTH);
    } catch (error) {
        throw new Error(`AI generation error: ${error.message}`);
    }
}

/**
 * Predicts commit message using AI
 * @param {string} diff - Git diff content
 * @returns {Promise<string>}
 */
async function predictCommitMessage(diff) {
    try {
        const prediction = await generateAICommitMessage(diff);

        const { useMessage } = await inquirer.prompt({
            type: "confirm",
            name: "useMessage",
            message: `AI suggests: "${prediction}"\n\nUse this message?`,
            default: true,
        });

        return useMessage ? prediction : await getManualCommitMessage();
    } catch (error) {
        logger.warning("AI prediction failed, falling back to manual input");
        return await getManualCommitMessage();
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
        const diff = await getGitDiff();

        if (!diff) {
            logger.warning("No staged changes found. Stage changes with 'git add'");
            return;
        }

        const choice = await showInitialMenu();

        if (choice === MENU_CHOICES.EXIT) {
            logger.warning("Process terminated!");
            return;
        }

        const commitMessage =
            choice === MENU_CHOICES.GENERATE ? await predictCommitMessage(diff) : await getManualCommitMessage();

        const { confirmCommit } = await inquirer.prompt({
            type: "confirm",
            name: "confirmCommit",
            message: `Commit with message: "${commitMessage}"?`,
            default: true,
        });

        if (!confirmCommit) {
            logger.warning("Commit cancelled.");
            return;
        }

        await executeGitCommand(`git commit -m "${commitMessage}"`);
        logger.success("Changes committed successfully!");

        await handlePostCommit();
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
