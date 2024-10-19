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
import { log } from "console";

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

async function ensureConfigDir() {
    try {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
    } catch (error) {
        throw new Error(`Failed to create config directory: ${error.message}`);
    }
}

async function readApiKey() {
    try {
        const config = await fs.readFile(CONFIG_FILE, "utf8");
        return JSON.parse(config).apiKey;
    } catch (error) {
        return null;
    }
}

async function storeApiKey(apiKey) {
    try {
        await ensureConfigDir();
        await fs.writeFile(CONFIG_FILE, JSON.stringify({ apiKey }));
    } catch (error) {
        throw new Error(`Failed to store API key: ${error.message}`);
    }
}

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

async function getGitDiff() {
    try {
        const { stdout } = await exec("git diff --cached");
        return stdout;
    } catch (error) {
        throw new Error(`Git diff error: ${error.message}`);
    }
}

function parseCommitMessages(text) {
    return text
        .split(/\d+\.\s+/)
        .slice(1)
        .map((msg) => msg.trim())
        .filter((msg) => msg.length > 0);
}

async function generateAICommitMessage(diff, genAI) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Generate a conventional commit message for this git diff. 
            STRICT REQUIREMENTS:
                - Strictly evaluate the contents of the 'Diff' given below and return the results
                - Maximum ${MAX_COMMIT_LENGTH} characters total
                - Include type suitable short prefix in lowercase (feat, fix, refactor etc.)
                - Be specific and concise reporting all the main changes
                - Return exactly 5 numbered options (1., 2., etc.)
                - Each option on a new line
                
            Diff: ${diff}
            Return ONLY the numbered commit messages.`;

        const result = await model.generateContent(prompt);
        const messages = parseCommitMessages(result.response.text());

        // Filter out any messages that exceed length limit
        return messages.filter((msg) => msg.length <= MAX_COMMIT_LENGTH);
    } catch (error) {
        throw new Error(`AI generation error: ${error.message}`);
    }
}

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

async function predictCommitMessage(diff, genAI) {
    try {
        const messages = await generateAICommitMessage(diff, genAI);

        if (!messages || messages.length === 0) {
            logger.warning("No valid commit messages generated");
            return null;
        }

        // Present messages as a list for selection
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
            pageSize: 7, // Show all options plus separator and return option
        });

        if (!selectedMessage) {
            return null;
        }

        // Allow user to edit the selected message
        const { editMessage } = await inquirer.prompt({
            type: "confirm",
            name: "editMessage",
            message: "Would you like to edit this message?",
            default: false,
        });

        if (editMessage) {
            const { customMessage } = await inquirer.prompt({
                type: "input",
                name: "customMessage",
                message: "Edit commit message:",
                default: selectedMessage,
                validate: (input) => {
                    if (input.length < MIN_MESSAGE_LENGTH) {
                        return `Message must be at least ${MIN_MESSAGE_LENGTH} characters.`;
                    }
                    if (input.length > MAX_COMMIT_LENGTH) {
                        return `Message too long. Maximum ${MAX_COMMIT_LENGTH} characters allowed.`;
                    }
                    return true;
                },
            });
            return customMessage;
        }

        return selectedMessage;
    } catch (error) {
        logger.warning("Commit message generation failed, returning to main menu");
        return null;
    }
}

async function executeGitCommand(command) {
    try {
        const { stdout, stderr } = await exec(command);
        if (stderr) logger.warning(stderr);
        if (stdout) logger.success(stdout);
    } catch (error) {
        throw new Error(`Git command error: ${error.message}`);
    }
}

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

async function main() {
    try {
        const genAI = await initializeAI();
        const diff = await getGitDiff();

        if (!diff) {
            logger.warning("No staged changes found. Stage changes with 'git add'");
            return;
        }

        while (true) {
            const choice = await showInitialMenu();

            if (choice === MENU_CHOICES.EXIT) {
                logger.warning("Process terminated!");
                return;
            }

            let commitMessage = null;

            if (choice === MENU_CHOICES.GENERATE) {
                commitMessage = await predictCommitMessage(diff, genAI);
                if (!commitMessage) {
                    continue;
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
                continue;
            }

            await executeGitCommand(`git commit -m "${commitMessage}"`);
            logger.success("Changes committed successfully!");

            await handlePostCommit();
            return;
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
