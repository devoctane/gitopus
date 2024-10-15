#!/usr/bin/env node

import inquirer from "inquirer";
import { exec } from "child_process";
import prefixes from "./data/prefixes.js";

/**
 * Selects the commit prefix from predefined options or allows a custom prefix.
 */
async function selectPrefix() {
    const choices = prefixes.map((prefix) => ({
        name: `${prefix.name}: ${prefix.description}`,
        value: prefix.name,
    }));

    choices.push({ name: "Add a custom prefix", value: "custom" });
    choices.push({ name: "Exit", value: null });

    const { prefix } = await inquirer.prompt({
        type: "list",
        name: "prefix",
        message: "Select the commit prefix:",
        choices: choices,
    });

    return prefix;
}

/**
 * Prompts the user to enter a custom prefix and description.
 */
async function addCustomPrefix() {
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

    return {
        name: customPrefixName,
        description: customPrefixDescription,
    };
}

/**
 * Performs the git commit operation with the selected prefix and message.
 */
async function gitCommitWithPrefix(prefix) {
    const { commitMessage } = await inquirer.prompt({
        type: "input",
        name: "commitMessage",
        message: "Enter the commit message:",
    });

    if (commitMessage.length < 10) {
        console.warn("\x1b[1;33m Commit message must be at least 10 characters long. \x1b[0m");
        return false;
    }

    const fullCommitMessage = `${prefix}: ${commitMessage}`;
    const { confirmCommit } = await inquirer.prompt({
        type: "confirm",
        name: "confirmCommit",
        message: `Are you sure you want to commit with the message: "${fullCommitMessage}"?`,
        default: false,
    });

    if (!confirmCommit) {
        console.warn("\x1b[1;33m Operation was terminated!\x1b[0m");
        return false;
    }

    return executeGitCommand(`git commit -m "${fullCommitMessage}"`);
}

/**
 * Displays the post-commit menu with options to push, check status, view logs, or exit.
 */
async function showPostCommitMenu() {
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
}

/**
 * Executes a given git command and logs the output.
 */
async function executeGitCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${command}: ${error.message}`);
                reject(error);
            } else if (stderr) {
                console.error(`Error: ${stderr}`);
                resolve(false);
            } else {
                console.log(stdout);
                resolve(true);
            }
        });
    });
}

/**
 * Main function to handle the commit process and post-commit actions.
 */
async function main() {
    try {
        const selectedPrefix = await selectPrefix();
        if (!selectedPrefix) {
            console.warn("\x1b[1;10m Operation was terminated!\x1b[0m");
            return;
        }

        const prefixToCommit = selectedPrefix === "custom" ? (await addCustomPrefix()).name : selectedPrefix;

        const commitSuccessful = await gitCommitWithPrefix(prefixToCommit);
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
        console.error("Error:", error);
        process.exit(1);
    }
}

/**
 * Handles post-commit actions like pushing, viewing status or logs.
 */
async function handlePostCommitAction(action) {
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
            console.warn("\x1b[31mInvalid option\x1b[0m");
    }
}

// Start the program
main();
