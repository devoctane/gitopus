#!/usr/bin/env node

import inquirer from "inquirer";
import { exec } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prefixes from "./data/prefixes.js";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

        return prediction;
    } catch (error) {
        console.error("Error predicting commit message:", error.message);
        return null;
    }
}

/**
 * Selects the commit prefix from predefined options or allows a custom prefix.
 */
async function selectPrefix(suggestedMessage = null) {
    try {
        const choices = prefixes.map((prefix) => ({
            name: `${prefix.name}: ${prefix.description}`,
            value: prefix.name,
        }));

        if (suggestedMessage) {
            choices.unshift({
                name: `Use AI suggestion: "${suggestedMessage}"`,
                value: "ai_suggestion",
            });
        }

        choices.push({ name: "Add a custom prefix", value: "custom" });
        choices.push({ name: "Exit", value: null });

        const { prefix } = await inquirer.prompt({
            type: "list",
            name: "prefix",
            message: "Select the commit prefix:",
            choices: choices,
        });

        return prefix;
    } catch (error) {
        console.error("Error selecting prefix:", error.message);
        process.exit(1);
    }
}

/**
 * Prompts the user to enter a custom prefix and description.
 */
async function addCustomPrefix() {
    try {
        const { customPrefixName, customPrefixDescription } = await inquirer.prompt([
            {
                type: "input",
                name: "customPrefixName",
                message: "Enter the custom prefix name:",
            },
            {
                type: "input",
                name: "customPrefixDescription",
                message: "Enter a description for the custom prefix:",
            },
        ]);

        if (!customPrefixName || !customPrefixDescription) {
            throw new Error("Custom prefix name or description cannot be empty.");
        }

        return {
            name: customPrefixName,
            description: customPrefixDescription,
        };
    } catch (error) {
        console.error("Error adding custom prefix:", error.message);
        process.exit(1);
    }
}

/**
 * Performs the git commit operation with the selected prefix and message.
 */
async function gitCommitWithPrefix(prefix, aiSuggestedMessage = null) {
    try {
        let commitMessage;

        if (prefix === "ai_suggestion" && aiSuggestedMessage) {
            commitMessage = aiSuggestedMessage;
        } else {
            const { message } = await inquirer.prompt({
                type: "input",
                name: "message",
                message: "Enter the commit message:",
                default: aiSuggestedMessage || "",
            });

            if (message.length < 10) {
                throw new Error("Commit message must be at least 10 characters long.");
            }

            commitMessage = `${prefix}: ${message}`;
        }

        const { confirmCommit } = await inquirer.prompt({
            type: "confirm",
            name: "confirmCommit",
            message: `Are you sure you want to commit with the message: "${commitMessage}"?`,
            default: false,
        });

        if (!confirmCommit) {
            console.warn("\x1b[1;33m Operation was terminated!\x1b[0m");
            return false;
        }

        return executeGitCommand(`git commit -m "${commitMessage}"`);
    } catch (error) {
        console.error("Error in git commit:", error.message);
        return false;
    }
}

/**
 * Displays the post-commit menu with options to push, check status, view logs, or exit.
 */
async function showPostCommitMenu() {
    try {
        const choices = [
            { name: "Push to remote (git push)", value: "push" },
            { name: "Check status (git status)", value: "status" },
            { name: "View commit log (git log)", value: "log" },
            { name: "Exit", value: "exit" },
        ];

        const { action } = await inquirer.prompt({
            type: "list",
            name: "action",
            message: "What would you like to do next?",
            choices: choices,
        });

        return action;
    } catch (error) {
        console.error("Error displaying post-commit menu:", error.message);
        process.exit(1);
    }
}

/**
 * Executes a given git command and logs the output.
 */
async function executeGitCommand(command) {
    try {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing ${command}: ${error.message}`);
                    reject(error);
                } else if (stderr) {
                    console.log(`${stderr}`);
                    resolve(false);
                    process.exit(1);
                } else {
                    console.log(stdout);
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error(`Error in command execution: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Main function to handle the commit process and post-commit actions.
 */
async function main() {
    try {
        // Get git diff and predict commit message
        const diff = await getGitDiff();
        let aiSuggestedMessage = null;

        if (diff) {
            aiSuggestedMessage = await predictCommitMessage(diff);
            if (aiSuggestedMessage) {
                console.log("\x1b[36mAI Suggested Commit Message:\x1b[0m", aiSuggestedMessage);
            }
        }

        const selectedPrefix = await selectPrefix(aiSuggestedMessage);
        if (!selectedPrefix) {
            console.warn("\x1b[1;33m Operation was terminated!\x1b[0m");
            return;
        }

        const prefixToCommit = selectedPrefix === "custom" ? (await addCustomPrefix()).name : selectedPrefix;

        const commitSuccessful = await gitCommitWithPrefix(
            prefixToCommit,
            selectedPrefix === "ai_suggestion" ? aiSuggestedMessage : null
        );

        if (commitSuccessful) {
            console.log("\x1b[32mCommitted successfully!\x1b[0m");

            let postCommitAction;
            do {
                postCommitAction = await showPostCommitMenu();
                await handlePostCommitAction(postCommitAction);
            } while (postCommitAction !== "exit");
        } else {
            console.warn("\x1b[31mCommit failed or was canceled!\x1b[0m");
            await main(); // Re-run the main function if the commit fails or is canceled
        }
    } catch (error) {
        console.error("Error in main process:", error.message);
        process.exit(1);
    }
}

/**
 * Handles post-commit actions like pushing, viewing status, or logs.
 */
async function handlePostCommitAction(action) {
    try {
        let command;
        switch (action) {
            case "push":
                command = "git push";
                await executeGitCommand(command);
                console.log("\x1b[32mPushing done!\x1b[0m");
                break;
            case "status":
                command = "git status";
                await executeGitCommand(command);
                break;
            case "log":
                command = "git log";
                await executeGitCommand(command);
                break;
            case "exit":
                console.log("\x1b[32mExiting...\x1b[0m");
                break;
            default:
                throw new Error("Invalid option selected");
        }
    } catch (error) {
        console.error("Error handling post-commit action:", error.message);
    }
}

// Start the program
main();