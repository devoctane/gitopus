import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { existsSync } from "fs";

export const DEFAULT_CONFIG = {
    maxCommitLength: 70,
    minMessageLength: 4,
    apiTimeout: 10000,
    maxRetries: 3,
    retryDelay: 1000,
    configVersion: "1.0.0",
};

export const COLORS = {
    SUCCESS: "\x1b[32m",
    WARNING: "\x1b[33m",
    ERROR: "\x1b[31m",
    RESET: "\x1b[0m",
};

// Configuration Management
export class Config {
    static CONFIG_DIR = path.join(os.homedir(), ".gitopus");
    static CONFIG_FILE = path.join(this.CONFIG_DIR, "config.json");

    static getEncryptionKey() {
        const baseKey = process.env.ENCRYPTION_KEY || "default-secure-key-123";
        return crypto.createHash("sha256").update(baseKey).digest();
    }

    static encrypt(text) {
        try {
            const iv = crypto.randomBytes(16);
            const key = this.getEncryptionKey();
            const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

            const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

            const authTag = cipher.getAuthTag();

            return Buffer.concat([iv, authTag, encrypted]).toString("base64");
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    static decrypt(encryptedData) {
        try {
            const buffer = Buffer.from(encryptedData, "base64");

            const iv = buffer.slice(0, 16);
            const authTag = buffer.slice(16, 32);
            const encrypted = buffer.slice(32);

            const key = this.getEncryptionKey();
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(authTag);

            return decipher.update(encrypted) + decipher.final("utf8");
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    static async load() {
        try {
            await fs.mkdir(this.CONFIG_DIR, { recursive: true });

            if (!existsSync(this.CONFIG_FILE)) {
                await fs.writeFile(this.CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG));
                return { ...DEFAULT_CONFIG };
            }

            const config = JSON.parse(await fs.readFile(this.CONFIG_FILE, "utf8"));
            return { ...DEFAULT_CONFIG, ...config };
        } catch (error) {
            throw new Error(`Configuration error: ${error.message}`);
        }
    }

    static async save(config) {
        try {
            await fs.writeFile(this.CONFIG_FILE, JSON.stringify(config, null, 2));
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error.message}`);
        }
    }
}