#!/usr/bin/env node

import inquirer from "inquirer";
import { exec } from "child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prefixes from "./data/prefixes.js";
import dotenv from "dotenv";

dotenv.config();

const MAX_COMMIT_LENGTH = 65;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

async function predictCommitMessage(diff) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `Given the following git diff, suggest a concise and meaningful commit message that follows conventional commit format. The entire message MUST BE NO LONGER THAN ${MAX_COMMIT_LENGTH} CHARACTERS, including the type prefix. Focus on the main changes and their purpose. Here's the diff:

        ${diff}
        
        Provide only the commit message without any additional explanation.`;

        const result = await model.generateContent(prompt);
        const prediction = result.response.text().trim();

        // Truncate if the AI response is too long
        const truncatedPrediction =
            prediction.length > MAX_COMMIT_LENGTH ? prediction.substring(0, MAX_COMMIT_LENGTH) : prediction;

        const { useMessage } = await inquirer.prompt({
            type: "confirm",
            name: "useMessage",
            message: `AI suggests: "${truncatedPrediction}"\n\nWould you like to use this message?`,
            default: true,
        });

        if (useMessage) {
            return truncatedPrediction;
        } else {
            return await getManualCommitMessage();
        }
    } catch (error) {
        console.error("Error predicting commit message:", error.message);
        return await getManualCommitMessage();
    }
}

async function getManualCommitMessage() {
    try {
        const { prefix } = await inquirer.prompt({
            type: "list",
            name: "prefix",
            message: "Select the commit type:",
            choices: prefixes.map((p) => ({
                name: `${p.name}: ${p.description}`,
                value: p.name,
            })),
        });

        const remainingLength = MAX_COMMIT_LENGTH - (prefix.length + 2); // +2 for ": "

        const { message } = await inquirer.prompt({
            type: "input",
            name: "message",
            message: `Enter the commit message (max ${remainingLength} characters):`,
            validate: (input) => {
                if (input.length < 10) {
                    return "Commit message must be at least 10 characters long.";
                }
                if (input.length > remainingLength) {
                    return `Message too long. Maximum ${remainingLength} characters allowed.`;
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

async function main() {
    try {
        const diff = await getGitDiff();
        if (!diff) {
            console.log("\x1b[33mNo staged changes found. Please stage your changes first using 'git add'.\x1b[0m");
            return;
        }

        const choice = await showInitialMenu();

        if (choice === "exit") {
            console.error("Process terminated!");
            return;
        }

        const commitMessage = choice === "generate" ? await predictCommitMessage(diff) : await getManualCommitMessage();

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

        await executeGitCommand(`git commit -m "${commitMessage}"`);
        console.log("\x1b[32mChanges committed successfully!\x1b[0m");

        await handlePostCommit();
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

main();
