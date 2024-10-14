#!/usr/bin/env node

import inquirer from "inquirer";
import { exec } from "child_process";

const prefixes = [
    { name: "init", description: "Initiated a new project" },
    { name: "feat", description: "A new feature or functionality" },
    { name: "fix", description: "A bug fix" },
    { name: "docs", description: "Documentation-only changes" },
    { name: "style", description: "Changes that do not affect the meaning of the code (white-space, formatting, etc.)" },
    { name: "refactor", description: "Code changes that neither fix a bug nor add a feature, but improve code structure" },
    { name: "perf", description: "A code change that improves performance" },
    { name: "test", description: "Adding or updating tests (unit, integration tests)" },
    { name: "chore", description: "Miscellaneous tasks (e.g., updating npm dependencies, tool configurations)" },
    { name: "build", description: "Changes that affect the build system or external dependencies" },
    { name: "ci", description: "Changes to CI configuration files and scripts" },
    { name: "revert", description: "Reverts a previous commit" },
    { name: "merge", description: "Merging branches" },
    { name: "hotfix", description: "Immediate bug fix, often deployed quickly" },
    { name: "deps", description: "Dependency updates" },
    { name: "env", description: "Environment-related changes (variables, server configs, etc.)" },
    { name: "wip", description: "Work In Progress (usually avoided in production commits)" },
];

async function selectPrefix() {
    const choices = prefixes.map((prefix) => ({
        name: `${prefix.name}: ${prefix.description}`,
        value: prefix.name,
    }));

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

async function gitCommitWithPrefix(prefix) {
    const { commitMessage } = await inquirer.prompt([
        {
            type: "input",
            name: "commitMessage",
            message: "Enter the commit message:",
        },
    ]);

    const fullCommitMessage = `${prefix}: ${commitMessage}`;

    exec(`git commit -m "${fullCommitMessage}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing commit: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error: ${stderr}`);
            return;
        }
    });
}

async function main() {
    const selectedPrefix = await selectPrefix();
    await gitCommitWithPrefix(selectedPrefix);
}

main().catch((error) => {
    console.error("Error:", error);
});
