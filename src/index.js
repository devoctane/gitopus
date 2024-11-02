#!/usr/bin/env node

import dotenv from "dotenv";
import { logger } from "./utils/logger.js";
import { Gitopus } from "./services/gitopus.js";

dotenv.config();

// Error handling for unhandled rejections
process.on("unhandledRejection", (error) => {
    logger.error(`Unhandled rejection: ${error.message}`);
    process.exit(1);
});

// Start the application
const app = new Gitopus();
app.run();