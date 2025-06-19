#!/bin/bash

# --- Configuration ---
INSTALL_DIR="$HOME/.newrev" # The dedicated installation directory for NewRev
VENV_DIR="$INSTALL_DIR/.venv" # Location of the Python virtual environment managed by uv

API_PORT=5000     # The port your backend API will run on
CLIENT_PORT=3000 # The port your frontend UI will run on

# --- Colors for Terminal Output ---
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
ORANGE='\033[0;33m' # Specific orange for warnings/notes
NC='\033[0m' # No Color

# --- Helper Function to Check for Global Commands ---
check_global_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: '$1' is not installed or not in your system's PATH.${NC}"
        echo -e "Please install '$1' and try again."
        echo -e "  - On Ubuntu/Debian: sudo apt install $1"
        echo -e "  - On macOS (with Homebrew): brew install $1"
        exit 1
    fi
}

# --- Helper Function to Install UV CLI if Missing ---
install_uv_cli() {
    echo -e "${YELLOW}Checking for uv CLI...${NC}"
    if ! command -v uv &> /dev/null; then
        echo -e "${ORANGE}uv CLI not found. Attempting to install it...${NC}"
        echo -e "${ORANGE}This will download and install uv to ~/.local/bin (or equivalent).${NC}" # Corrected comment
        # Use the official uv installer script
        curl -LsSf https://astral.sh/uv/install.sh | sh
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to install uv CLI.${NC}"
            echo -e "${RED}Please install uv manually from https://astral.sh/uv/install.sh and ensure it's in your PATH, then re-run this script.${NC}"
            exit 1
        fi
        # --- FIX STARTS HERE ---
        # Add ~/.local/bin to PATH for the current script execution
        export PATH="$HOME/.local/bin:$PATH"
        # --- FIX ENDS HERE ---
        echo -e "${GREEN}uv CLI installed and added to PATH for this session.${NC}"
    else
        echo -e "${GREEN}uv CLI already installed.${NC}"
    fi
}

# --- Start of Installation Script ---
echo -e "${GREEN}--- Starting NewRev Automated Setup ---${NC}"

# --- Check/Install Global Dependencies ---
echo -e "${YELLOW}Checking for required global tools (git, npm, node, python3, rsync)...${NC}"
check_global_command git
check_global_command npm
check_global_command node
check_global_command python3
check_global_command rsync # Ensure rsync is available

# --- Copy Project to Dedicated Installation Directory ---
# Use rsync to copy project files, excluding the .git directory
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${GREEN}Creating NewRev installation directory: $INSTALL_DIR${NC}"
    mkdir -p "$INSTALL_DIR" || { echo -e "${RED}Failed to create installation directory.${NC}"; exit 1; }
    echo -e "${GREEN}Copying NewRev project files to $INSTALL_DIR (excluding .git/)...${NC}"
    # Use rsync to copy, excluding .git directory
    rsync -a --exclude='.git/' . "$INSTALL_DIR/" || { echo -e "${RED}Failed to copy project files. Exiting.${NC}"; exit 1; }
    echo -e "${GREEN}Project files copied.${NC}"
else
    echo -e "${YELLOW}NewRev already seems installed at $INSTALL_DIR.${NC}"
    echo -e "${YELLOW}Updating files in $INSTALL_DIR (excluding .git/)...${NC}"
    # Use rsync to update, excluding .git directory
    rsync -a --exclude='.git/' . "$INSTALL_DIR/" || { echo -e "${RED}Failed to update project files. Exiting.${NC}"; exit 1; }
    echo -e "${GREEN}Project files updated.${NC}"
fi

# Change to the installation directory for all subsequent operations
cd "$INSTALL_DIR" || { echo -e "${RED}Failed to change to installation directory '$INSTALL_DIR'. Exiting.${NC}"; exit 1; }

# --- Install uv CLI if missing ---
install_uv_cli

# --- Python Virtual Environment Setup with uv ---
echo -e "${GREEN}Setting up Python virtual environment with uv at '${VENV_DIR}' (preferring Python 3.12, downloading if needed)...${NC}"

# Remove existing venv to ensure clean state with uv, if it was created by a different method
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Existing virtual environment found. Removing to create a fresh uv venv.${NC}"
    rm -rf "$VENV_DIR" || { echo -e "${RED}Failed to remove existing virtual environment.${NC}"; exit 1; }
fi

# Create the uv virtual environment, preferring 3.12, or falling back to >=3.10
# uv will attempt to provision Python 3.12 if not found, then any >=3.10.
uv venv --python "3.12" "$VENV_DIR" || uv venv --python ">=3.10" "$VENV_DIR" || { echo -e "${RED}Failed to create uv virtual environment with Python >=3.10. Please ensure a compatible Python version is available on your system or can be provisioned by uv.${NC}"; exit 1; }
echo -e "${GREEN}uv virtual environment created.${NC}"

# Activate the virtual environment
source "$VENV_DIR/bin/activate" || { echo -e "${RED}Failed to activate virtual environment.${NC}"; exit 1; }
echo -e "${GREEN}Virtual environment activated.${NC}"

# Ensure pip is up-to-date in the venv
echo -e "${YELLOW}Upgrading pip in virtual environment...${NC}"
uv pip install --upgrade pip || { echo -e "${RED}Failed to upgrade pip.${NC}"; }


# --- Install NewRev Python Package (making 'newrev' command available) ---
echo -e "${GREEN}Installing NewRev Python package (backend). This makes 'newrev' command available.${NC}"
# Use uv pip install for the editable install of the main package
uv pip install -e . || { echo -e "${RED}Failed to install NewRev Python package. Exiting.${NC}"; exit 1; }

# --- Install Core Backend Dependencies from api/requirements.txt ---
echo -e "${GREEN}Installing core backend dependencies from api/requirements.txt...${NC}"
# Check if api/requirements.txt exists before trying to install from it
if [ -f "api/requirements.txt" ]; then
    uv pip install -r api/requirements.txt || { echo -e "${RED}Failed to install core backend dependencies from api/requirements.txt. Exiting.${NC}"; exit 1; }
    echo -e "${GREEN}Core backend dependencies from api/requirements.txt installed.${NC}"
else
    echo -e "${RED}Error: api/requirements.txt not found. Please ensure the file exists in the correct location.${NC}"
    exit 1
fi

# --- Install Node.js Frontend Dependencies ---
echo -e "${GREEN}Installing Node.js frontend dependencies...${NC}"
(cd "$INSTALL_DIR/client" && npm install) || { echo -e "${RED}Failed to install Node.js dependencies.${NC}"; exit 1; }
echo -e "${GREEN}Node.js dependencies installed.${NC}"

# --- Create newrev-run script in user's PATH (for easy backend execution) ---
RUN_SCRIPT_PATH="$HOME/.local/bin/newrev-run" # Standard location for user binaries
mkdir -p "$(dirname "$RUN_SCRIPT_PATH")" # Ensure the directory exists
echo -e "${GREEN}Creating helper script '$RUN_SCRIPT_PATH' for easy backend execution...${NC}"
cat <<EOF > "$RUN_SCRIPT_PATH"
#!/bin/bash
# Helper script to activate NewRev venv and run newrev in the current project directory
# This script is generated by NewRev's installer.

# --- Configuration (DO NOT MODIFY MANUALLY) ---
INSTALL_DIR="$HOME/.newrev" # Reference the installation directory
VENV_PATH="$INSTALL_DIR/.venv" # Path to the virtual environment created by install.sh
# --- End Configuration ---

# Activate the virtual environment and run the backend
if [ -f "\$VENV_PATH/bin/activate" ]; then
    source "\$VENV_PATH/bin/activate" || { echo -e "${RED}Failed to activate virtual environment: \$VENV_PATH. Exiting.${NC}"; exit 1; }
    echo -e "${BLUE}NewRev virtual environment activated.${NC}"
    echo -e "${GREEN}Starting NewRev API in current project: $(pwd)${NC}"
    # Run the backend using the virtual environment's python directly on the app.py file
    # Use the absolute path to api/app.py within the installed directory
    "\$VENV_PATH/bin/python" "\$INSTALL_DIR/api/app.py" "\$@" # <-- CHANGED THIS LINE
else
    echo -e "${RED}Error: NewRev virtual environment not found at \$VENV_PATH.${NC}"
    echo -e "Please re-run the NewRev installation script: ~/.newrev/install.sh"
    exit 1
fi
EOF
chmod +x "$RUN_SCRIPT_PATH" || { echo -e "${RED}Failed to make newrev-run executable.${NC}"; exit 1; }
echo -e "${GREEN}Helper script created at $RUN_SCRIPT_PATH.${NC}"

# --- Create newrev-client script for frontend execution ---
CLIENT_SCRIPT_PATH="$HOME/.local/bin/newrev-client" # Standard location for user binaries
mkdir -p "$(dirname "$CLIENT_SCRIPT_PATH")" # Ensure the directory exists
echo -e "${GREEN}Creating helper script '$CLIENT_SCRIPT_PATH' for easy frontend execution...${NC}"
cat <<EOF > "$CLIENT_SCRIPT_PATH"
#!/bin/bash
# Helper script to start the NewRev frontend UI

# --- Configuration (DO NOT MODIFY MANUALLY) ---
INSTALL_DIR="$HOME/.newrev"
CLIENT_PORT=3000
# --- End Configuration ---

echo -e "${GREEN}--- Starting NewRev Frontend UI ---${NC}"
echo -e "${YELLOW}Frontend will run on port ${CLIENT_PORT}. It will connect to the backend (newrev) when you start it.${NC}"
echo -e "${YELLOW}Starting frontend... (Output is logged to \$INSTALL_DIR/newrev_client.log)${NC}"

# nohup runs a command immune to hangups, with output redirected
nohup npm --prefix "\$INSTALL_DIR/client" run dev > "\$INSTALL_DIR/newrev_client.log" 2>&1 &
CLIENT_PID=\$! # Get the Process ID of the last background command
echo -e "${GREEN}Frontend started (PID: \${CLIENT_PID}). Check '\$INSTALL_DIR/newrev_client.log' for details.${NC}"
echo -e "You can now open your web browser to: ${BLUE}http://localhost:\${CLIENT_PORT}${NC}"
echo -e "${NC}To stop the frontend, find its PID (it's \${CLIENT_PID}) and run ${YELLOW}kill \${CLIENT_PID}${NC}."
EOF
chmod +x "$CLIENT_SCRIPT_PATH" || { echo -e "${RED}Failed to make newrev-client executable.${NC}"; exit 1; }
echo -e "${GREEN}Helper script created at $CLIENT_SCRIPT_PATH.${NC}"


# Check if ~/.local/bin is in PATH and advise if not
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo -e "${YELLOW}Warning: $HOME/.local/bin is not in your system's PATH.${NC}"
    echo -e "${YELLOW}You may need to add it to your shell's configuration file (~/.bashrc, ~/.zshrc, ~/.profile) for 'newrev-run' and 'newrev-client' to be directly callable.${NC}"
    echo -e "  Example: echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc && source ~/.bashrc"
fi


# --- Final Instructions for User ---
echo -e "${GREEN}--- NewRev Automated Setup Complete! ---${NC}"

echo -e "${GREEN}Usage:${NC}"
echo -e "Once the installation is complete, you will have two new commands (${YELLOW}newrev-client${NC} and ${YELLOW}newrev-run${NC}) available in your terminal."
echo -e ""
echo -e "${BLUE}Run the Backend:${NC} Open a terminal window and:"
echo -e "  1. Navigate to the root of the GitHub project you want newrev to work on:"
echo -e "     ${YELLOW}cd ~/Documents/my-awesome-repo${NC}"
echo -e "  2. Run the backend with one of these options:"
echo -e "     ${BLUE}# DeepSeek${NC}"
echo -e "     ${YELLOW}newrev-run --model deepseek --api-key deepseek=<api-key>${NC}"
echo -e "     ${BLUE}# Claude 3.7 Sonnet${NC}"
echo -e "     ${YELLOW}newrev-run --model sonnet --api-key anthropic=<api-key>${NC}"
echo -e "     ${BLUE}# o3-mini${NC}"
echo -e "     ${YELLOW}newrev-run --model o3-mini --api-key openai=<api-key>${NC}"
echo -e "     ${BLUE}# Ollama${NC}"
echo -e "     ${YELLOW}export OLLAMA_API_BASE=http://127.0.0.1:11434${NC}"
echo -e "     ${YELLOW}newrev-run --model ollama_chat/<model>${NC}"
echo -e "     ${YELLOW}# Example: newrev-run --model ollama_chat/llama2${NC}"
echo -e ""
echo -e "     ${YELLOW}Keep this new terminal window open; it will show the backend's output. To stop the backend, press Ctrl+C.${NC}"
echo -e ""
echo -e "${BLUE}Start the Frontend UI:${NC} Open a ${YELLOW}NEW terminal window${NC} and run:"
echo -e "  ${YELLOW}newrev-client${NC}"
echo -e ""
echo -e "You can now open your web browser to: ${BLUE}http://localhost:${CLIENT_PORT}${NC}"
echo -e ""
echo -e "${GREEN}Enjoy NewRev!${NC}"