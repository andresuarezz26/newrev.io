#!/bin/bash

# --- Configuration ---
PROJECT_NAME="newrev" # The name of the directory that git clone will create
REPO_URL="https://github.com/andresuarezz26/newrev.git"
# If your project clones into 'newrev.io', change PROJECT_NAME to 'newrev.io'
# PROJECT_NAME="newrev.io"

# Determine the absolute path where the script is being run from
SCRIPT_DIR=$(pwd)

# Paths relative to the project root (will be set after cd into PROJECT_NAME)
API_DIR=""
CLIENT_DIR=""
API_APP_PATH=""

VENV_DIR="$SCRIPT_DIR/$PROJECT_NAME/.venv" # Path for the virtual environment

API_PORT=5000
CLIENT_PORT=3000

# --- Colors for Output ---
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Helper Functions ---
check_global_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}Error: '$1' is not installed or not in your PATH.${NC}"
        echo -e "Please install '$1' and try again. For example:"
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "  - Ubuntu/Debian: sudo apt install $1"
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            echo "  - macOS (Homebrew): brew install $1"
        fi
        exit 1
    fi
}

# --- Welcome and Checks ---
echo -e "${GREEN}--- Starting NewRev Installation & Setup ---${NC}"

echo -e "${YELLOW}Checking for required global tools (git, npm, node)...${NC}"
check_global_command git
check_global_command npm
check_global_command node # npm implies node, but good to double check

# --- Clone Project if Not Exists ---
if [ ! -d "$PROJECT_NAME" ]; then
    echo -e "${GREEN}Project directory '$PROJECT_NAME' not found. Cloning repository...${NC}"
    git clone "$REPO_URL" "$PROJECT_NAME" || { echo -e "${RED}Failed to clone repository. Exiting.${NC}"; exit 1; }
    echo -e "${GREEN}Repository cloned successfully.${NC}"
else
    echo -e "${YELLOW}Project directory '$PROJECT_NAME' already exists. Skipping cloning.${NC}"
    echo -e "${YELLOW}Ensure you are running this script from the parent directory of '$PROJECT_NAME'.${NC}"
fi

# Change to the project root directory
cd "$PROJECT_NAME" || { echo -e "${RED}Failed to change to project directory '$PROJECT_NAME'. Exiting.${NC}"; exit 1; }
PROJECT_ROOT=$(pwd) # Update PROJECT_ROOT to the actual cloned directory

# Set paths relative to the new PROJECT_ROOT
API_DIR="$PROJECT_ROOT/api"
CLIENT_DIR="$PROJECT_ROOT/client"
API_APP_PATH="$API_DIR/app.py"

# --- Python Version and Virtual Environment Setup ---
PYTHON_EXE=""
echo -e "${YELLOW}Checking for Python 3.12 or suitable Python 3 installation...${NC}"

# Check for python3.12 directly
if command -v python3.12 &> /dev/null; then
    PYTHON_EXE="python3.12"
    echo -e "${GREEN}Found Python 3.12.${NC}"
# Check for generic python3
elif command -v python3 &> /dev/null; then
    PYTHON_EXE="python3"
    PYTHON_VERSION=$($PYTHON_EXE -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    echo -e "${YELLOW}Found Python $PYTHON_VERSION.${NC}"
    if [[ "$PYTHON_VERSION" != "3.12" ]]; then
        echo -e "${YELLOW}Warning: Python 3.12 is recommended. Using Python $PYTHON_VERSION for the virtual environment.${NC}"
        echo -e "         If you encounter issues, please install Python 3.12 globally or via pyenv/conda."
    fi
else
    echo -e "${RED}Error: Python 3.12 or a generic python3 is not installed or not in your PATH.${NC}"
    echo -e "Please install Python 3.x (preferably 3.12) and try again."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  - Ubuntu/Debian: sudo apt install python3.12 python3.12-venv"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  - macOS (Homebrew): brew install python@3.12"
    fi
    exit 1
fi

echo -e "${GREEN}Setting up Python virtual environment in ${VENV_DIR}...${NC}"
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Virtual environment already exists. Reusing.${NC}"
else
    "$PYTHON_EXE" -m venv "$VENV_DIR" || { echo -e "${RED}Failed to create virtual environment.${NC}"; exit 1; }
    echo -e "${GREEN}Virtual environment created.${NC}"
fi

# Activate the virtual environment
source "$VENV_DIR/bin/activate" || { echo -e "${RED}Failed to activate virtual environment.${NC}"; exit 1; }
echo -e "${GREEN}Virtual environment activated.${NC}"

# Ensure pip is up-to-date in the venv
echo -e "${YELLOW}Upgrading pip in virtual environment...${NC}"
pip install --upgrade pip || { echo -e "${RED}Failed to upgrade pip.${NC}"; }


# --- Install Python Backend Dependencies ---
echo -e "${GREEN}Installing Python backend dependencies...${NC}"

# Install root requirements if they exist (assuming newrev itself has requirements)
if [ -f "$PROJECT_ROOT/requirements.txt" ]; then
    echo -e "${YELLOW}Installing root Python requirements...${NC}"
    pip install -r "$PROJECT_ROOT/requirements.txt" || { echo -e "${RED}Failed to install root Python requirements.${NC}"; exit 1; }
fi

# Install API-specific requirements
if [ -f "$API_DIR/requirements.txt" ]; then
    echo -e "${YELLOW}Installing API-specific Python requirements...${NC}"
    pip install -r "$API_DIR/requirements.txt" || { echo -e "${RED}Failed to install API Python requirements.${NC}"; exit 1; }
fi

echo -e "${GREEN}Python dependencies installed in virtual environment.${NC}"

# --- Install Node.js Frontend Dependencies ---
echo -e "${GREEN}Installing Node.js frontend dependencies...${NC}"
if [ -d "$CLIENT_DIR" ]; then
    (cd "$CLIENT_DIR" && npm install) || { echo -e "${RED}Failed to install Node.js dependencies.${NC}"; exit 1; }
else
    echo -e "${RED}Error: Frontend client directory '$CLIENT_DIR' not found. This should not happen if cloned correctly.${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js dependencies installed.${NC}"

# --- Get API Key ---
echo -e "${YELLOW}--- Anthropic API Key Setup ---${NC}"
echo -e "Your API key is needed to run the backend API."
read -p "Please enter your Anthropic API Key: " ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: Anthropic API Key cannot be empty. Exiting.${NC}"
    exit 1
fi

# --- Run Backend API ---
echo -e "${GREEN}--- Starting Backend API ---${NC}"
echo -e "${YELLOW}API will run on port ${API_PORT}. Look for messages from Aider here.${NC}"
echo -e "${YELLOW}Starting API... (Output will be redirected to newrev_api.log in background)${NC}"

# Run the API using the Python from the virtual environment
# Ensure your api/app.py reads ANTHROPIC_API_KEY from environment variables (os.getenv).
# Note: `--model sonnet` is kept as per your original request. Adjust if app.py handles this differently.
nohup "$VENV_DIR/bin/python3" "$API_APP_PATH" --model sonnet > newrev_api.log 2>&1 &

API_PID=$! # Get PID of the last background command
echo -e "${GREEN}Backend API started (PID: $API_PID). Check newrev_api.log for its output.${NC}"

# --- Run Frontend ---
echo -e "${GREEN}--- Starting Frontend Application ---${NC}"
echo -e "${YELLOW}Frontend will run on port ${CLIENT_PORT}.${NC}"
echo -e "${YELLOW}Starting frontend... (Output will be redirected to newrev_client.log in background)${NC}"

# Run the frontend
nohup npm --prefix "$CLIENT_DIR" run dev > newrev_client.log 2>&1 &

CLIENT_PID=$!
echo -e "${GREEN}Frontend started (PID: $CLIENT_PID). Check newrev_client.log for its output.${NC}"

# --- Final Instructions ---
echo -e "${GREEN}--- Installation and Setup Complete! ---${NC}"
echo -e "1. ${NC}Open your browser and navigate to: ${BLUE}http://localhost:${CLIENT_PORT}${NC}"
echo -e "2. ${NC}The backend API is running in the background with PID ${YELLOW}$API_PID${NC} (output in ${YELLOW}newrev_api.log${NC})."
echo -e "3. ${NC}The frontend is running in the background with PID ${YELLOW}$CLIENT_PID${NC} (output in ${YELLOW}newrev_client.log${NC})."
echo -e "4. ${NC}To stop both processes, open a new terminal in this directory and use: ${YELLOW}kill $API_PID $CLIENT_PID${NC}"
echo -e "   If that doesn't work, you can find them with 'ps aux | grep newrev' and then 'kill <PID>'."
echo -e "${GREEN}Enjoy NewRev!${NC}"