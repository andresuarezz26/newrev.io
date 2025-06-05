# Aider Browser API

This is a Flask API backend for Aider that allows using Aider's functionality from a browser-based interface. It exposes Aider's core capabilities through REST endpoints and WebSockets for real-time communication.

## Features

- Session-based chat with LLMs
- File management (add/remove files to chat)
- Web page content scraping
- Git integration with undo capabilities
- PRD generation, task breakdown, and automatic task execution

## Setup

1. Install dependencies:

```bash
cd api
pip install -r requirements.txt
pip install -e ..  # Install aider in development mode
```

2. Run the API server:

```bash
python app.py
```

The server will start on http://localhost:5000.

## API Endpoints

### Session Management

- `POST /api/init` - Initialize a new session
- `POST /api/clear_history` - Clear chat history

### Chat

- `POST /api/send_message` - Send a message to Aider
- `WebSocket` - Receive real-time message chunks

### File Management

- `GET /api/get_files` - Get all files and in-chat files
- `POST /api/add_files` - Add files to the chat
- `POST /api/remove_files` - Remove files from the chat
- `POST /api/add_web_page` - Add web page content to chat

### Git Integration

- `POST /api/undo_commit` - Undo the last commit

### PRD and Task Automation

- `POST /api/generate_prd` - Generate a PRD from a description
- `POST /api/generate_tasks` - Generate tasks from a PRD
- `POST /api/execute_tasks` - Execute a list of tasks
- `GET /api/task_status` - Get the status of task execution

## WebSocket Events

- `connect` - Client connected
- `disconnect` - Client disconnected
- `message_chunk` - Chunk of a message from Aider
- `message_complete` - Message completed
- `files_edited` - Files edited by Aider
- `commit` - Commit made by Aider
- `prd_chunk` - Chunk of PRD generation
- `prd_complete` - PRD generation completed
- `tasks_chunk` - Chunk of tasks generation
- `tasks_complete` - Tasks generation completed
- `task_started` - Task execution started
- `task_chunk` - Chunk of task execution
- `task_completed` - Task execution completed
- `tasks_execution_started` - Tasks execution started
- `tasks_execution_completed` - Tasks execution completed

## Notes

- The API must be run within a git repository
- Multiple sessions can be managed with different session IDs
- All communication with the LLM is streamed via WebSockets 