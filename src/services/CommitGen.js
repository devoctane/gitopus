import { GoogleGenerativeAI } from "@google/generative-ai";

export default class AIOperations {
    constructor(apiKey, config) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.config = config;
    }

    async generateCommitMessage(diff) {
        let attempts = 0;
        while (attempts < this.config.maxRetries) {
            try {
                const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
                const prompt = this._buildPrompt(diff);

                const result = await Promise.race([
                    model.generateContent(prompt),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("API Timeout")), this.config.apiTimeout)),
                ]);

                return this._parseMessages(result.response.text());
            } catch (error) {
                attempts++;
                if (error.message.includes("quota")) {
                    throw new APIError("API rate limit exceeded", true);
                }
                if (attempts === this.config.maxRetries) {
                    throw new APIError(`AI generation failed after ${attempts} attempts: ${error.message}`);
                }
                await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
            }
        }
    }

    _buildPrompt(diff) {
        return `Generate a conventional commit message for this git diff. 
             STRICT REQUIREMENTS:
                 - Strictly evaluate the contents of the 'Diff' given below
                 - Maximum ${this.config.maxCommitLength} characters total
                 - Include type suitable short prefix in lowercase (feat, fix, refactor, test,docs, style, chore etc.)
                 - Be specific reporting all the main changes separated by commas
                 - Return exactly 5 numbered options (1., 2., etc.)
                 - Each option on a new line
                 
             Diff: ${diff}
             Return ONLY the numbered commit messages.`;
    }

    _parseMessages(text) {
        return text
            .split(/\d+\.\s+/)
            .slice(1)
            .map((msg) => msg.trim())
            .filter((msg) => msg.length > 0 && msg.length <= this.config.maxCommitLength);
    }
}
