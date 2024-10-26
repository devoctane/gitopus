import { COLORS } from "../config/config.js";

export const logger = {
    success: (msg) => console.log(`${COLORS.SUCCESS}${msg}${COLORS.RESET}`),
    warning: (msg) => console.log(`${COLORS.WARNING}${msg}${COLORS.RESET}`),
    error: (msg) => console.error(`${COLORS.ERROR}${msg}${COLORS.RESET}`),
};
