# Newrev

[Newrev](https://newrev.io) is the web UI for terminal-based AI coding agents. Run your favorite open-source AI coding agent in your browser.

We started by supporting [aider](https://github.com/paul-gauthier/aider) and plan to integrate [codex](https://github.com/openai/codex) and [plandex](https://github.com/plandex-ai/plandex) in the future.

---

## Demo

![demo](https://github.com/user-attachments/assets/3e59b6b0-f0d5-4e9c-8f3d-1aeea47076d9)

## Features

* **Chat Modes:** Switch between Ask, Context, and Chat modes to suit your workflow.
* **Basic IDE Features:** File explorer, read-only file viewer, and search functionality.
* **Self-Hosted Ollama Support:** Seamlessly work with Ollama in a self-hosted environment.
* **Broad AI Model Support:** Compatible with Claude, OpenAI, and Deepseek models.
* **Live Preview:** Real-time live preview for web applications.

---

## Why a Browser UI?

We built Newrev as a browser-based interface because it offers several key benefits for AI-assisted coding:

**Lightweight**:
Newrev runs as a lightweight web app, while the heavy work is handled by terminal-based AI agents. This keeps your computer fast and responsive, using less resources.

**Work with different agents**:
Some coding agents need step-by-step guidance, others work more independently. The browser UI lets you combine and control these agents easily. You can also mix Newrev agents with agents that works with the IDE. 

**Portability, zero-setup**:
Thanks to its architecture, Newrev is designed to be capable of support cloud-based setups. This unlocks features as coding with just a link, no installation required and access your environment from any device.

**Interface customization**:
Unlike IDE plugins, a browser UI lets us design custom layouts that match how each AI agent works.

## Experimental Disclaimer

Newrev is an experimental project currently in active development. It's not yet stable, so you might encounter bugs, incomplete features, or breaking changes as we evolve. We're building this in the open with the community and truly welcome:

Bug reports
Feature requests
Pull requests
Good vibes!
Help us improve by opening issues or submitting pull requests. Check out our Contributing section for more details on how you can help.

### Usage

Once the installation is complete, you will have two new commands (`newrev-client` and `newrev-run`) available in your terminal.

1. **Run the Backend**:
   Open a terminal window and:

   Navigate to the root of the GitHub project you want newrev to work on:
   ```bash
   cd ~/Documents/my-awesome-repo
   ```

   Run the backend with one of these options:
   ```bash
   # DeepSeek
   newrev-run --model deepseek --api-key deepseek=<api-key>

   # Claude 3.7 Sonnet
   newrev-run --model sonnet --api-key anthropic=<api-key>

   # o3-mini
   newrev-run --model o3-mini --api-key openai=<api-key>

   # Ollama
   export OLLAMA_API_BASE=http://127.0.0.1:11434
   newrev-run --model ollama_chat/<model>
   # Example: newrev-run --model ollama_chat/llama2
   ```

   Keep this new terminal window open; it will show the backend's output. To stop the backend, press Ctrl+C.

2. **Start the Frontend UI**:
   Open a NEW terminal window and run:
   ```bash
   newrev-client
   ```
   
   You can now open your web browser to: http://localhost:3000

---

## Requirements

* [Node.js](https://nodejs.org/)
* [Python 3.8-3.13](https://www.python.org/)

---

## 🛠️ Installation Guide

### MAC & LINUX Installation using script

1. **Clone the repository**: Open your terminal and clone the repository to your desired location. 

```bash
git clone git@github.com:newrev-io/newrev.git
```

2. **Navigate into the cloned directory**:

```bash
cd newrev
```

3. **Make the installation script executable and run it**:
This script will install uv (a fast Python package manager), set up the Python virtual environment, install backend dependencies, and install Node.js frontend dependencies.

```bash
chmod +x install.sh
./install.sh
```

### WINDOWS Installation

For Windows users, we recommend using Git Bash or Windows Subsystem for Linux (WSL) to follow the Mac & Linux instructions, as the install.sh script is a Bash script.

#### Using Git Bash:
1. Install Git for Windows: This includes Git Bash.
2. Open Git Bash.
3. Follow the MAC & LINUX steps above.

#### Using Windows Subsystem for Linux (WSL):
1. Install WSL: Follow Microsoft's official guide to install WSL and a Linux distribution (e.g., Ubuntu).
2. Open your WSL terminal.
3. Install git, npm, node, python3, within your WSL environment if they are not already present:
```bash
sudo apt update && sudo apt install git npm nodejs python3 rsync
```
4. Follow the MAC & LINUX steps above.

---

## Contributing

We're just getting started. Contributions, ideas, and PRs are welcome! Feel free to [open an issue](https://github.com/newrev-io/newrev/issues), create a pull request or suggest features.

---