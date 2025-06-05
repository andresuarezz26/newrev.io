#!/usr/bin/env python

import hashlib
import json
import os
import sys
import threading
import time
from pathlib import Path
import traceback
import logging
import flask
from flask import Flask, jsonify, request, send_from_directory, Response, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime
import queue
from dotenv import load_dotenv

# Add the parent directory to sys.path to be able to import aider modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aider import urls
from aider.coders import Coder
from aider.dump import dump  # noqa: F401
from aider.io import InputOutput
from aider.main import main as cli_main
from aider.scrape import Scraper

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Store sessions by session_id
sessions = {}

# Message queues for session streaming
message_queues = {}

# Load environment variables from .env file
load_dotenv()

class AiderAPI:
    """API wrapper for Aider functionality"""
    
    class CaptureIO(InputOutput):
        """Custom IO class that captures output for the API"""
        lines = []

        def tool_output(self, msg, log_only=False):
            if not log_only:
                self.lines.append(msg)
            super().tool_output(msg, log_only=log_only)

        def tool_error(self, msg):
            self.lines.append(msg)
            super().tool_error(msg)

        def tool_warning(self, msg):
            self.lines.append(msg)
            super().tool_warning(msg)

        def get_captured_lines(self):
            lines = self.lines
            self.lines = []
            return lines

    @staticmethod
    def initialize_coder(args=None):
        """Initialize a coder instance with optional args"""
        logger = logging.getLogger(__name__)
        logger.debug("\n=== Starting Coder Initialization ===")
        logger.debug(f"Current working directory: {os.getcwd()}")
        
        try:
            # Check if we're in a git repo
            from git import Repo
            try:
                repo = Repo(os.getcwd(), search_parent_directories=True)
                logger.debug(f"Found git repo at: {repo.git_dir}")
            except Exception as e:
                logger.error(f"Failed to find git repo: {str(e)}")
                raise ValueError("API must be run inside a git repository")

            logger.debug("Creating coder instance...")
            coder = cli_main(argv=args, return_coder=True)
            logger.debug(f"Coder instance created: {type(coder)}")
            
            if not isinstance(coder, Coder):
                logger.error(f"Invalid coder type: {type(coder)}")
                raise ValueError(f"Invalid coder instance: {coder}")
            
            if not coder.repo:
                logger.error("No git repo found in coder instance")
                raise ValueError("API can currently only be used inside a git repo")
            
            logger.debug(f"Coder repo path: {coder.repo.repo.git_dir}")
            
            io = AiderAPI.CaptureIO(
                pretty=False,
                yes=True,
                dry_run=coder.io.dry_run,
                encoding=coder.io.encoding,
            )
            logger.debug("Created CaptureIO instance")
            
            coder.commands.io = io
            
            # Force the coder to cooperate, regardless of cmd line args
            coder.yield_stream = True
            coder.stream = True
            coder.pretty = False
            
            logger.debug("=== Coder initialization completed successfully ===\n")
            return coder
            
        except Exception as e:
            logger.error("\n=== Error during coder initialization ===")
            logger.error(f"Error: {str(e)}")
            logger.error(f"Traceback:\n{traceback.format_exc()}")
            raise
    
    @staticmethod
    def get_announcements(coder):
        """Get announcements from coder"""
        return coder.get_announcements()
    
    @staticmethod
    def process_chat(coder, prompt, session_id):
        """Process a chat message and queue response for streaming"""
        def run_stream():
            try:
                # Ensure the session has a message queue
                if session_id not in message_queues:
                    message_queues[session_id] = queue.Queue()
                
                # Get the queue for this session
                message_queue = message_queues[session_id]
                
                # Process the prompt and stream response
                for chunk in coder.run_stream(prompt):
                    # Add chunk to the queue
                    message_queue.put({
                        'type': 'message_chunk',
                        'data': {'chunk': chunk, 'session_id': session_id}
                    })
                
                # Mark message as complete
                message_queue.put({
                    'type': 'message_complete',
                    'data': {'session_id': session_id}
                })
                
                # Check for edits
                if coder.aider_edited_files:
                    message_queue.put({
                        'type': 'files_edited',
                        'data': {'files': list(coder.aider_edited_files), 'session_id': session_id}
                    })
                
                # Check for commits
                if sessions[session_id].get('last_aider_commit_hash') != coder.last_aider_commit_hash:
                    if coder.last_aider_commit_hash:
                        commits = f"{coder.last_aider_commit_hash}~1"
                        diff = coder.repo.diff_commits(
                            coder.pretty,
                            commits,
                            coder.last_aider_commit_hash,
                        )
                        
                        message_queue.put({
                            'type': 'commit',
                            'data': {
                                'hash': coder.last_aider_commit_hash,
                                'message': coder.last_aider_commit_message,
                                'diff': diff,
                                'session_id': session_id
                            }
                        })
                        
                        sessions[session_id]['last_aider_commit_hash'] = coder.last_aider_commit_hash
            except Exception as e:
                print(f"Error in process_chat: {str(e)}")
                print(traceback.format_exc())
                
                # Add error to queue
                if session_id in message_queues:
                    message_queues[session_id].put({
                        'type': 'error',
                        'data': {'message': str(e), 'session_id': session_id}
                    })
        
        # Create and start thread
        thread = threading.Thread(target=run_stream)
        thread.daemon = True
        thread.start()
        return True

    @staticmethod
    def scrape_url(url):
        """Scrape content from a URL"""
        scraper = Scraper(print_error=lambda x: x)
        return scraper.scrape(url)

# Helper function to get a session or create if it doesn't exist
def get_or_create_session(session_id, create=True):
    """Get or create a session by ID"""
    logger = logging.getLogger(__name__)
    
    logger.debug(f"get_or_create_session called with ID: {session_id}")
    logger.debug(f"Current sessions: {list(sessions.keys())}")
    
    if session_id not in sessions and create:
        logger.debug(f"Creating new session for ID: {session_id}")
        try:
            coder = AiderAPI.initialize_coder()
            logger.debug("Coder initialized successfully")
            
            # Get initial files before creating session
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            logger.debug(f"Found files - All: {all_files}, InChat: {inchat_files}")
            
            sessions[session_id] = {
                'coder': coder,
                'messages': [],
                'files': inchat_files,
                'last_aider_commit_hash': coder.last_aider_commit_hash,
                'input_history': list(coder.io.get_input_history()),
                'created_at': time.time()
            }
            logger.debug(f"Session created successfully")
            
            # Add initialization announcements
            announcements = AiderAPI.get_announcements(coder)
            sessions[session_id]['messages'].append({
                'role': 'info', 
                'content': '\n'.join(announcements)
            })
            sessions[session_id]['messages'].append({
                'role': 'assistant', 
                'content': 'How can I help you?'
            })
            logger.debug("Added initial messages to session")
            
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None, str(e)
    else:
        logger.debug(f"Using existing session: {session_id}")
    
    return sessions.get(session_id), None

# Routes
@app.route('/api/init', methods=['POST'])
def initialize_session():
    """Initialize a new session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    return jsonify({
        'status': 'success',
        'messages': session['messages'],
        'files': session['files']
    })

@app.route('/api/send_message', methods=['POST'])
def send_message():
    """Send a message to the aider coder"""
    data = request.json
    session_id = data.get('session_id')
    message = data.get('message')
    
    if not session_id or not message:
        return jsonify({'status': 'error', 'message': 'Session ID and message are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    # Add message to history
    session['messages'].append({'role': 'user', 'content': message})
    coder.io.add_to_input_history(message)
    session['input_history'].append(message)
    
    # Process message asynchronously
    AiderAPI.process_chat(coder, message, session_id)
    
    return jsonify({'status': 'success'})

# Server-Sent Events (SSE) endpoint for streaming responses
@app.route('/api/stream', methods=['GET'])
def message_stream():
    """Stream messages for a session using Server-Sent Events"""
    session_id = request.args.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    # Create a queue for this session if it doesn't exist
    if session_id not in message_queues:
        message_queues[session_id] = queue.Queue()
    
    # Get the queue for this session
    message_queue = message_queues[session_id]
    
    # Define the generator function for SSE
    def generate():
        try:
            # First event to establish connection
            yield 'event: connected\ndata: {"session_id": "' + session_id + '"}\n\n'
            
            while True:
                try:
                    # Try to get a message from the queue, timeout after 30 seconds
                    message = message_queue.get(timeout=30)
                    
                    # Format the message as an SSE event
                    event_type = message['type']
                    data = json.dumps(message['data'])
                    
                    yield f"event: {event_type}\ndata: {data}\n\n"
                    
                    # If this is a message_complete event, also yield a keep-alive
                    if event_type == 'message_complete':
                        yield 'event: keep-alive\ndata: {}\n\n'
                        
                except queue.Empty:
                    # Send a keep-alive event every 30 seconds to maintain the connection
                    yield 'event: keep-alive\ndata: {}\n\n'
        except GeneratorExit:
            # Client disconnected
            print(f"Client disconnected from stream: {session_id}")
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'  # Disable buffering for Nginx
        }
    )

@app.route('/api/test_message', methods=['POST'])
def test_message():
    """Test endpoint for message streaming"""
    data = request.json
    session_id = data.get('session_id')
    message = data.get('message', 'No message provided')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    # Create a queue for this session if it doesn't exist
    if session_id not in message_queues:
        message_queues[session_id] = queue.Queue()
    
    # Create a simple response
    response = {
        'session_id': session_id,
        'message': f"Server received: {message}",
        'timestamp': time.time()
    }
    
    # Add to the message queue as chunks
    response_str = json.dumps(response)
    chunk_size = 10  # Small chunk size for testing
    
    for i in range(0, len(response_str), chunk_size):
        chunk = response_str[i:i+chunk_size]
        message_queues[session_id].put({
            'type': 'message_chunk',
            'data': {'chunk': chunk, 'session_id': session_id}
        })
        # Small sleep to simulate streaming
        time.sleep(0.1)
    
    # Mark as complete
    message_queues[session_id].put({
        'type': 'message_complete',
        'data': {'session_id': session_id}
    })
    
    return jsonify({'status': 'success'})

@app.route('/api/get_files', methods=['GET'])
def get_files():
    """Get all files and in-chat files"""
    logger = logging.getLogger(__name__)
    logger.debug("get_files endpoint called")
    
    try:
        session_id = request.args.get('session_id')
        logger.debug(f"Session ID received: {session_id}")
        
        if not session_id:
            logger.error("No session ID provided")
            return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
        
        logger.debug(f"Getting session for ID: {session_id}")
        session, error = get_or_create_session(session_id)
        
        if error:
            logger.error(f"Error getting session: {error}")
            return jsonify({'status': 'error', 'message': error}), 500
        
        if not session:
            logger.error(f"No session found for ID: {session_id}")
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404
        
        logger.debug("Session retrieved successfully")
        coder = session['coder']
        
        try:
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            logger.debug(f"Files retrieved - All: {all_files}, InChat: {inchat_files}")
            
            response = {
                'status': 'success',
                'all_files': all_files,
                'inchat_files': inchat_files
            }
            logger.debug(f"Returning response: {response}")
            
            return jsonify(response)
            
        except Exception as e:
            logger.error(f"Error getting files: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                'status': 'error',
                'message': f'Error retrieving files: {str(e)}'
            }), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in get_files: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/api/add_files', methods=['POST'])
def add_files():
    """Add files to the chat"""
    data = request.json
    session_id = data.get('session_id')
    files = data.get('files', [])
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    added_files = []
    
    for fname in files:
        if fname not in coder.get_inchat_relative_files():
            coder.add_rel_fname(fname)
            added_files.append(fname)
            session['messages'].append({'role': 'info', 'content': f'Added {fname} to the chat'})
    
    return jsonify({
        'status': 'success',
        'added_files': added_files
    })

@app.route('/api/remove_files', methods=['POST'])
def remove_files():
    """Remove files from the chat"""
    data = request.json
    session_id = data.get('session_id')
    files = data.get('files', [])
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    removed_files = []
    
    for fname in files:
        if coder.drop_rel_fname(fname):
            removed_files.append(fname)
            session['messages'].append({'role': 'info', 'content': f'Removed {fname} from the chat'})
    
    return jsonify({
        'status': 'success',
        'removed_files': removed_files
    })

@app.route('/api/add_web_page', methods=['POST'])
def add_web_page():
    """Add web page content to chat"""
    data = request.json
    session_id = data.get('session_id')
    url = data.get('url')
    
    if not session_id or not url:
        return jsonify({'status': 'error', 'message': 'Session ID and URL are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    content = AiderAPI.scrape_url(url)
    
    if content and content.strip():
        content = f"{url}\n\n{content}"
        session['messages'].append({'role': 'text', 'content': content})
        return jsonify({'status': 'success', 'content': content})
    else:
        return jsonify({'status': 'error', 'message': f'No web content found for {url}'}), 404

@app.route('/api/undo_commit', methods=['POST'])
def undo_commit():
    """Undo the last commit"""
    data = request.json
    session_id = data.get('session_id')
    commit_hash = data.get('commit_hash')
    
    if not session_id or not commit_hash:
        return jsonify({'status': 'error', 'message': 'Session ID and commit hash are required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    
    if session['last_aider_commit_hash'] != commit_hash or coder.last_aider_commit_hash != commit_hash:
        return jsonify({
            'status': 'error', 
            'message': f'Commit {commit_hash} is not the latest commit'
        }), 400
    
    coder.commands.io.get_captured_lines()
    reply = coder.commands.cmd_undo(None)
    lines = coder.commands.io.get_captured_lines()
    lines_text = "\n".join(lines)
    
    session['messages'].append({'role': 'info', 'content': lines_text})
    session['last_aider_commit_hash'] = None
    
    if reply:
        session['messages'].append({'role': 'assistant', 'content': reply})
    
    return jsonify({'status': 'success', 'message': lines_text})

@app.route('/api/clear_history', methods=['POST'])
def clear_history():
    """Clear chat history"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session, error = get_or_create_session(session_id)
    
    if error:
        return jsonify({'status': 'error', 'message': error}), 500
    
    coder = session['coder']
    coder.done_messages = []
    coder.cur_messages = []
    
    # Keep only the initial messages and add a new info message
    initial_messages = session['messages'][:2]  # Keep announcements and initial greeting
    session['messages'] = initial_messages
    session['messages'].append({
        'role': 'info', 
        'content': 'Cleared chat history. Now the LLM can\'t see anything before this line.'
    })
    
    return jsonify({'status': 'success'})

@app.route('/api/repo_file', methods=['GET'])
def get_repo_file():
    """Get a file from the repository"""
    file_name = request.args.get('file_name')
    
    if not file_name:
        return jsonify({'status': 'error', 'message': 'File name is required'}), 400
    
    # Check if we're in a git repo
    try:
        from git import Repo
        repo = Repo(os.getcwd(), search_parent_directories=True)
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to find git repository: {e}'}), 500
    
    # Check if the file exists in the repository
    full_path = os.path.join(repo.git_dir, file_name)
    
    if not os.path.exists(full_path):
        return jsonify({'status': 'error', 'message': f'File {file_name} not found in repository'}), 404
    
    try:
        # Read the file content
        with open(full_path, 'r') as f:
            file_content = f.read()
        
        return jsonify({
            'status': 'success',
            'file_content': file_content
        })
    except Exception as e:
        print(f"Error reading file: {str(e)}")
        return jsonify({'status': 'error', 'message': f'Error reading file: {str(e)}'}), 500

if __name__ == '__main__':
    print("=== Starting Aider API Server ===")
    print(f"Current working directory: {os.getcwd()}")
    
    # Check if we're in a git repo
    try:
        from git import Repo
        repo = Repo(os.getcwd(), search_parent_directories=True)
        print(f"Found git repository at: {repo.git_dir}")
    except Exception as e:
        print(f"Failed to find git repository: {e}")
        print("The API server must be run from within a git repository")
        sys.exit(1)
    
    # Note about using hardcoded API key
    print("NOTICE: Using hardcoded Anthropic API key for testing purposes")
    print("The API key is directly embedded in the code for the PRD analysis functionality")
    
    # Run the server
    print("Starting Flask server...")
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    ) 