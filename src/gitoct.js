#!/usr/bin/env node

import inquirer from "inquirer";
import { exec } from "child_process";
import prefixes from "./data/prefixes.js";

async function selectPrefix() {
    const choices = prefixes.map((prefix) => ({
        name: `${prefix.name}: ${prefix.description}`,
        value: prefix.name,
    }));

    choices.push({ name: "Add a custom prefix", value: "custom" });
    choices.push({ name: "Exit", value: null });

    const answer = await inquirer.prompt([
        {
            type: "list",
            name: "prefix",
            message: "Select the commit prefix:",
            choices: choices,
        },
    ]);

    return answer.prefix;
}

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

async function gitCommitWithPrefix(prefix) {
    const { commitMessage } = await inquirer.prompt([
        {
            type: "input",
            name: "commitMessage",
            message: "Enter the commit message:",
        },
    ]);

    if (commitMessage.length < 10) {
        console.warn("\x1b[1;33m Commit message must be at least 10 characters long. \x1b[0m");
        return false;
    }

    const fullCommitMessage = `${prefix}: ${commitMessage}`;

    const { confirmCommit } = await inquirer.prompt([
        {
            type: "confirm",
            name: "confirmCommit",
            message: `Are you sure you want to commit with the message: "${fullCommitMessage}"?`,
            default: false,
        },
    ]);

    if (!confirmCommit) {
        console.warn("\x1b[1;33m Operation was terminated!\x1b[0m");
        return false;
    }

    // Execute the commit command using a promise-based approach
    return new Promise((resolve, reject) => {
        exec(`git commit -m "${fullCommitMessage}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing commit: ${error.message}`);
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

async function main() {
    const selectedPrefix = await selectPrefix();
    if (selectedPrefix === null) {
        console.warn("\x1b[1;10m Operation was terminated!\x1b[0m");
        return;
    }

    let prefixToCommit;
    if (selectedPrefix === "custom") {
        const customPrefix = await addCustomPrefix();
        prefixToCommit = customPrefix.name;
    } else {
        prefixToCommit = selectedPrefix;
    }

    const commitSuccessful = await gitCommitWithPrefix(prefixToCommit);
    if (commitSuccessful) {
        console.log("\x1b[32mCommitted successfully!\x1b[0m");
        process.exit(0);
    } else {
        console.warn("\x1b[31mCommit failed or was canceled!\x1b[0m");
        await main();
    }
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
