# Gitopus

![Gitopus Logo](https://octane-spaces.blr1.cdn.digitaloceanspaces.com/gitopus/images/gitopus.png)

### **Gitopus** is an open-source command-line tool that leverages Google's Gemini AI to help generate meaningful commit messages and streamline your Git workflow through an interactive interface.

## Features

-   🤖 AI-powered commit message generation using Google's Gemini
-   🎯 Interactive menu for choosing between AI-generated or manual commit messages
-   📝 Conventional commit format support with predefined prefixes
-   ⚡ Post-commit actions (push, status, log) for streamlined workflow
-   ✨ Smart validation for commit message length and format
-   🔄 Option to edit AI-generated messages before committing

## Installation

To install **gitopus**, you need to have Node.js and npm (Node Package Manager) installed on your machine.

1. **Install Node.js**: If you haven't already, download and install Node.js from [nodejs.org](https://nodejs.org/).

2. **Install gitopus globally**: Open your terminal or command prompt and run:
    ```bash
    npm install -g gitopus
    ```

## Getting Started

### Setting Up Your API Key

1. **Get Your Gemini API Key**:

    - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
    - Sign in with your Google account
    - Click on "Create API Key"
    - Copy your new API key

2. **First-Time Setup**:
   When you first run Gitopus, it will automatically:
    ```bash
    gt
    ```
    You'll see:
    ```
    No API key found. Please enter your Gemini API key.
    You can get an API key from: https://makersuite.google.com/app/apikey
    ```
3. **Enter Your API Key**:

    - Paste your API key when prompted
    - The key will be securely stored in `~/.gitopus/config.json`
    - You won't need to enter it again on this machine

4. **Verify Setup**:
    - After entering your API key, you should see:
    ```
    API key stored successfully!
    ```
    - The tool will then proceed to the main menu

### API Key Management

-   **Location**: Your API key is stored in `~/.gitopus/config.json`
-   **Update Key**: To update your API key, either:
    -   Edit the config file directly
    -   Delete the config file and run Gitopus again
-   **Security**: Keep your API key secure and never share it

## Usage

Once **gitopus** is installed and configured, follow these steps:

1. Stage your changes in the Git repository:

    ```bash
    git add .
    ```

2. Run the command:

    ```bash
    gitopus
    ```

    or

    ```bash
    gitoct
    ```

    or

    ```bash
    gt
    ```

3. Choose your preferred method:
    - **Generate commit message**: AI will analyze your changes and suggest commit messages
    - **Custom commit message**: Manually create a commit with conventional prefixes
    - **Exit**: Cancel the commit process

### AI-Generated Commits

When using the AI generation feature:

1. The tool analyzes your staged changes
2. Presents 5 AI-generated commit message options
3. Select your preferred message
4. Optionally edit the selected message
5. Confirm and create the commit

### Manual Commits

For manual commit creation:

1. Select a conventional commit prefix (feat, fix, docs, etc.)
2. Enter your commit message
3. Review and confirm the complete commit message

### Post-Commit Actions

After committing, choose from:

-   Push changes to remote repository
-   View git status
-   View latest commit in log
-   Exit the tool

## Configuration

Gitopus stores its configuration in `~/.gitopus/config.json`, including your API key. You can manually edit this file if needed.

## Common Issues

-   **No staged changes**: Ensure you've staged your changes with `git add`
-   **API key issues**:
    -   Make sure your API key is valid
    -   Check if the config file exists at `~/.gitopus/config.json`
    -   Try deleting the config file and entering the key again
-   **Long commit messages**: Messages are limited to 70 characters for best practices

## Contributing

We welcome contributions to **Gitopus**! Here's how you can help:

### 1. Fork and Clone

```bash
git clone https://github.com/devoctane/gitopus.git
cd gitopus
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Make Changes

Create a new branch and make your changes:

```bash
git checkout -b feature-name
```

### 4. Test

Ensure your changes work as expected and add tests if necessary.

### 5. Submit PR

1. Push your changes to your fork
2. Create a Pull Request with a clear description of your changes
3. Wait for review and address any feedback

## License

MIT License - see LICENSE file for details

---

Built with ❤️ by Team Octane

For more information, check out the [Gitopus GitHub repository](https://github.com/devoctane/gitopus).
