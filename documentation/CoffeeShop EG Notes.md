# SysMLv2 Github Initialisation



Thes are the steps for initialising Github when wotking with SysMLv2 in VS Code with Seaside Modeller, etc.

### Install GitHub CLI (Optional / if not already installed)

```bash
# On macOS with Homebrew (global installation)
brew install gh

# Verify installation
gh --version

# Login to GitHub (one-time setup)
gh auth login
```

### Verify SSH Setup

If you want to verify your SSH connection works:

```bash
# Test SSH connection to GitHub
ssh -T git@github.com

"Hi ella66gr! You've successfully authenticated, but GitHub does not provide shell access.""
```

### Initialise Git

```bash
# Make initial commit
git init
git add -A
git commit -m "SysMLv2 'Funky-Shop' example project setup"
```

### Create GitHub Repository

```bash
# Using GitHub CLI (recommended)
gh repo create funky-shop1 --public --source=. --remote=origin
# Wait a moment, then:
git push -u origin main

# If push is done too quickly (e.g. as a flag), propagation delay can result in an error message
# OR manually create repository on GitHub and push
# git remote add origin https://github.com/ella66gr/funky-shop1.git
# git push -u origin main
```