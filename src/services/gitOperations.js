import { GitError } from "../error/error.js";
import { promisify } from "util";
import { exec as execCallback } from "child_process";

const exec = promisify(execCallback);
export class GitOperations {
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
