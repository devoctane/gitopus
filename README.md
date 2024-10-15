# Gitopus

<!-- ![Gitopus Logo](https://octane-spaces.blr1.cdn.digitaloceanspaces.com/gitoct/images/gitoct.png) -->

![Gitopus Logo](https://octane-spaces.blr1.cdn.digitaloceanspaces.com/gitopus/images/gitopus.png)

### **Gitopus** is a command-line tool that simplifies your Git commit process by providing an interactive interface for selecting conventional commit prefixes.

## Features

-   Interactive menu for selecting commit prefixes.
-   Prompts for detailed commit messages.
-   Streamlined process for creating conventional commits.
-   Enhances code clarity and collaboration within teams.

## Installation

To install **gitopus**, you need to have Node.js and npm (Node Package Manager) installed on your machine.

1. **Install Node.js**: If you haven't already, download and install Node.js from [nodejs.org](https://nodejs.org/).

2. **Install gitopus globally**: Open your terminal or command prompt and run the following command:

    ```bash
    npm install -g gitopus
    ```

## Usage

Once **gitopus** is installed, you can use it to create Git commit messages **after you have staged your changes with `git add`**:

1. Stage your changes in the Git repository:

    ```bash
    git add .
    ```

2. Run the `gitopus` command:

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

3. You will see an interactive menu with available commit prefixes. Use the arrow keys to select a prefix and press Enter.

4. After selecting a prefix, enter your commit message when prompted.

5. Your commit will be created using the selected prefix and message.

## Example

Here's an example of how to use **gitopus**:

```bash
cd /path/to/your/repo
git add .       # Stage your changes first
gt          # Run the gitopus command
```

-   **Select a prefix**:

    ```
    Select the commit prefix:
      feat: A new feature or functionality
      fix: A bug fix
      docs: Documentation-only changes
      ...
    ```

-   **Enter your commit message**:
    ```
    Enter the commit message: Add user registration page
    ```

This will create a commit like:

```bash
git commit -m "feat: Add user registration page"
```

For more information or to contribute, please visit the [Gitopus GitHub repository](https://github.com/devoctane/gitopus).
