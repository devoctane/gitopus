#!/usr/bin/env node

import inquirer from "inquirer";
import { exec } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prefixes from "./data/prefixes.js";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Shows the initial menu with three options
*/
async function showInitialMenu() {
    try {
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
    } catch (error) {
        console.error("Error showing menu:", error.message);
        process.exit(1);
    }
}

/**
 * Gets the current git changes (diff) to analyze
 */
async function getGitDiff() {
    try {
        return new Promise((resolve, reject) => {
            exec("git diff --cached", (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (stderr) {
                    reject(new Error(stderr));
                    return;
                }
                resolve(stdout);
            });
        });
    } catch (error) {
        console.error("Error getting git diff:", error.message);
        return null;
    }
}

/**
 * Predicts a commit message using Gemini AI based on the git diff
 */
async function predictCommitMessage(diff) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `Given the following git diff, suggest a concise and meaningful commit message that follows conventional commit format. Focus on the main changes and their purpose. Here's the diff:

        ${diff}
        
        Provide only the commit message without any additional explanation.`;

        const result = await model.generateContent(prompt);
        const prediction = result.response.text().trim();

        // Show the prediction to the user and ask for confirmation
        const { useMessage } = await inquirer.prompt({
            type: "confirm",
            name: "useMessage",
            message: `AI suggests: "${prediction}"\n\nWould you like to use this message?`,
            default: true,
        });

        if (useMessage) {
            return prediction;
        } else {
            return await getManualCommitMessage();
        }
    } catch (error) {
        console.error("Error predicting commit message:", error.message);
        return await getManualCommitMessage();
    }
}

/**
 * Gets a manual commit message from the user
 */
async function getManualCommitMessage() {
    try {
        // First, select the prefix
        const { prefix } = await inquirer.prompt({
            type: "list",
            name: "prefix",
            message: "Select the commit type:",
            choices: prefixes.map((p) => ({
                name: `${p.name}: ${p.description}`,
                value: p.name,
            })),
        });

        // Then get the commit message
        const { message } = await inquirer.prompt({
            type: "input",
            name: "message",
            message: "Enter the commit message:",
            validate: (input) => {
                if (input.length < 10) {
                    return "Commit message must be at least 10 characters long.";
                }
                return true;
            },
        });

        return `${prefix}: ${message}`;
    } catch (error) {
        console.error("Error getting manual commit message:", error.message);
        process.exit(1);
    }
}

/**
 * Executes a git command and returns the result
 */
async function executeGitCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${command}: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.log(stderr);
            }
            if (stdout) {
                console.log(stdout);
            }
            resolve(true);
        });
    });
}

/**
 * Shows the post-commit menu and handles the selected action
 */
async function handlePostCommit() {
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
                await executeGitCommand("git push");
                console.log("\x1b[32mChanges pushed successfully!\x1b[0m");
                break;
            case "status":
                await executeGitCommand("git status");
                await handlePostCommit();
                break;
            case "log":
                await executeGitCommand("git log -1");
                await handlePostCommit();
                break;
            case "exit":
                console.error("Process terminated!");
                break;
        }
    } catch (error) {
        console.error("Error in post-commit actions:", error.message);
        process.exit(1);
    }
}

/**
 * Main function that orchestrates the commit process
 */
async function main() {
    try {
        // Check if there are staged changes
        const diff = await getGitDiff();
        if (!diff) {
            console.log("\x1b[33mNo staged changes found. Please stage your changes first using 'git add'.\x1b[0m");
            return;
        }

        // Show the initial menu
        const choice = await showInitialMenu();

        // Handle exit choice
        if (choice === "exit") {
            console.error("Process terminated!");
            return;
        }

        // Get the commit message based on user's choice
        const commitMessage = choice === "generate" ? await predictCommitMessage(diff) : await getManualCommitMessage();

        // Confirm the commit
        const { confirmCommit } = await inquirer.prompt({
            type: "confirm",
            name: "confirmCommit",
            message: `Commit with message: "${commitMessage}"?`,
            default: true,
        });

        if (!confirmCommit) {
            console.log("\x1b[33mCommit cancelled.\x1b[0m");
            return;
        }

        // Perform the commit
        await executeGitCommand(`git commit -m "${commitMessage}"`);
        console.log("\x1b[32mChanges committed successfully!\x1b[0m");

        // Show post-commit options
        await handlePostCommit();
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

// Start the program
main();
