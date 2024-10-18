# Gitopus

![Gitopus Logo](https://octane-spaces.blr1.cdn.digitaloceanspaces.com/gitopus/images/gitopus.png)

### **Gitopus** is an open-source command-line tool that simplifies your Git commit process by providing an interactive interface for selecting conventional commit prefixes.

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
gt              # Run the gitopus command
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

## Contributing

We welcome contributions to **Gitopus**! If you'd like to contribute, follow the steps below:

### 1. Fork the repository

Visit the [Gitopus GitHub repository](https://github.com/devoctane/gitopus) and click the **Fork** button to create your own copy of the repository.

### 2. Clone the forked repository

Clone the repository to your local machine using the following command:

```bash
git clone https://github.com/devoctane/gitopus.git
```

### 3. Create a new branch

Create a new branch for your feature or bug fix:

```bash
git checkout -b feature-or-bug-fix-name
```

### 4. Make changes

Make your changes and ensure everything is working correctly.

### 5. Commit your changes

After making changes, commit them using **Gitopus**:

```bash
git add .
gt           # Run gitopus to commit with a prefix
```

Alternatively, commit manually:

```bash
git commit -m "feat: Add feature or bug fix"
```

### 6. Push to your fork

Push your changes to your forked repository:

```bash
git push origin feature-or-bug-fix-name
```

### 7. Submit a pull request

Go to the original **Gitopus** repository and submit a pull request with a description of your changes.

---

Thank you for contributing to **Gitopus**!

For more information, check out the [Gitopus GitHub repository](https://github.com/devoctane/gitopus).

Team Octane!
