# Newrev

[Newrev](https://newrev.io)  is an open-source Web UI designed for open-source, terminal-based AI coding agents.

Run a powerful terminal-based AI coding agent from a lightweight IDE that operates directly in your browser.

We started by supporting [aider](https://github.com/paul-gauthier/aider) and plan to integrate [codex](https://github.com/openai/codex) and [Plandex](https://github.com/plandex-ai/plandex) in the future.

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
* [Python 3.x](https://www.python.org/) (Any recent Python 3 version is generally fine, as uv will manage the specific Python version for the virtual environment)

---

## 🛠️ Installation Guide

### MAC & LINUX Installation using script

1. **Clone the repository**: Open your terminal and clone the repository to your desired location. 

```bash
git clone git@github.com:newrev-io/newrev.git
```

2. **Navigate into the cloned directory**:

```bash
cd newrev.io
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

## Manual Installation

If you prefer to install the components manually, follow these steps:

1. **Clone the project**:
```bash
git clone git@github.com:newrev-io/newrev.git
```

2. **Move to the root directory of the project**:
```bash
cd [Absolute_path]/newrev.io
```

3. **Install aider requirements**:
```bash
pip install -r requirements.txt
```

4. **Install api requirements**:
```bash
pip install -r api/requirements.txt
pip install -e ..
```

5. **Run the backend**:
Move to the root directory of the GitHub project you want to use with newrev and run the command based on the current location of newrev project. This process runs on port 5000.
```bash
python3 [Absolute_path]/newrev.io/api/app.py --model sonnet --api-key anthropic=<api-key>
```

6. **Run the frontend**:
This process runs on port 3000.
```bash
cd [Absolute_path]/newrev/client
npm install
npm run dev
```

Note: Replace `[Absolute_path]` with the actual absolute path to your newrev installation directory.

---

## Contributing

We're just getting started. Contributions, ideas, and PRs are welcome! Feel free to [open an issue](https://github.com/newrev-io/newrev/issues) or suggest features.

---