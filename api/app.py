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
from aider.run_cmd import run_cmd

# Add the parent directory to sys.path to be able to import aider modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aider import urls
from aider.coders import Coder
from aider.dump import dump  # noqa: F401
from aider.io import InputOutput
from aider.main import main as cli_main
from aider.scrape import Scraper

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["file://*", "http://localhost:*", "https://localhost:*", "*"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept"],
        "supports_credentials": True
    }
})

# Store sessions by session_id
sessions = {}

# Message queues for session streaming
message_queues = {}

# Track cancellation requests per session
cancellation_requests = {}

# Load environment variables from .env file
load_dotenv()

# Add after the app initialization
SESSIONS_DIR = Path("sessions")
SESSIONS_DIR.mkdir(exist_ok=True)

def save_session(session_id, session_data):
    """Save session data to disk"""
    # Ensure the sessions directory exists
    SESSIONS_DIR.mkdir(exist_ok=True)
    
    session_file = SESSIONS_DIR / f"{session_id}.json"
    # Convert coder object to a serializable format
    serializable_data = {
        'messages': session_data['messages'],
        'files': session_data['files'],
        'last_aider_commit_hash': session_data['last_aider_commit_hash'],
        'input_history': session_data['input_history'],
        'created_at': session_data['created_at']
    }
    with open(session_file, 'w') as f:
        json.dump(serializable_data, f)

def load_session(session_id):
    """Load session data from disk"""
    session_file = SESSIONS_DIR / f"{session_id}.json"
    if session_file.exists():
        with open(session_file, 'r') as f:
            return json.load(f)
    return None

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
        
        # Add default args to suppress warnings if no args provided
        if args is None:
            args = ['--no-show-model-warnings']
        elif '--no-show-model-warnings' not in args:
            args = ['--no-show-model-warnings'] + args
        
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
        """Process a chat message and queue response for streaming - matches gui.py logic exactly"""
        def run_stream():
            logger = logging.getLogger(__name__)
            logger.error("🔄 " + "="*50)
            logger.error("🔄 PROCESS_CHAT THREAD STARTED - GUI.PY STYLE")
            logger.error("🔄 " + "="*50)
            
            try:
                # Ensure the session has a message queue
                if session_id not in message_queues:
                    message_queues[session_id] = queue.Queue()
                    logger.error(f"📋 Created new message queue for session: {session_id}")
                
                # Get the queue for this session
                message_queue = message_queues[session_id]
                logger.error(f"📋 Got message queue for session: {session_id}")
                
                # Check the current mode to determine if we should use reflections
                current_mode = getattr(coder, 'edit_format', 'code')
                use_reflections = (current_mode == 'code')
                
                logger.error(f"🎯 Mode-based Processing:")
                logger.error(f"   Current mode: {current_mode}")
                logger.error(f"   Use reflections: {use_reflections}")
                
                if use_reflections:
                    # This duplicates logic from within Coder (matches gui.py exactly) - CODE MODE ONLY
                    num_reflections = 0
                    max_reflections = 3
                    current_prompt = prompt
                    
                    logger.error(f"🧠 Reflection Setup (gui.py style - CODE MODE):")
                    logger.error(f"   Max reflections: {max_reflections}")
                    logger.error(f"   Initial prompt: {current_prompt[:100]}{'...' if len(current_prompt) > 100 else ''}")
                    
                    # Main reflection loop - EXACTLY like gui.py: while prompt: (CODE MODE ONLY)
                    while current_prompt:
                        logger.error(f"🔁 WHILE LOOP ITERATION - prompt exists (CODE MODE)")
                        logger.error(f"   Current prompt: {current_prompt[:100]}{'...' if len(current_prompt) > 100 else ''}")
                        logger.error(f"   Reflections so far: {num_reflections}/{max_reflections}")
                        
                        # Stream the assistant response (like gui.py: st.write_stream(self.coder.run_stream(prompt)))
                        full_response = ""
                        chunk_count = 0
                        logger.error(f"🌊 Starting stream for current prompt...")
                        
                        for chunk in coder.run_stream(current_prompt):
                            # Check for cancellation before processing each chunk
                            if cancellation_requests.get(session_id, False):
                                logger.error(f"🚫 CANCELLATION DETECTED - stopping stream (CODE MODE)")
                                message_queue.put({
                                    'type': 'message_cancelled',
                                    'data': {'session_id': session_id, 'message': 'Request cancelled by user'}
                                })
                                # Clear the cancellation flag
                                cancellation_requests[session_id] = False
                                return
                            
                            chunk_count += 1
                            full_response += chunk
                            
                            # Log first few chunks for debugging
                            if chunk_count <= 3:
                                logger.error(f"   Chunk {chunk_count}: {chunk[:50]}{'...' if len(chunk) > 50 else ''}")
                            
                            # Add chunk to the queue
                            message_queue.put({
                                'type': 'message_chunk',
                                'data': {'chunk': chunk, 'session_id': session_id}
                            })
                        
                        logger.error(f"🌊 Stream completed:")
                        logger.error(f"   Total chunks: {chunk_count}")
                        logger.error(f"   Response length: {len(full_response)}")
                        
                        # Add the complete assistant message to session (like gui.py)
                        if session_id in sessions:
                            sessions[session_id]['messages'].append({
                                'role': 'assistant', 
                                'content': full_response
                            })
                            logger.error(f"💾 Added assistant response to session messages")
                        
                        # Mark this response as complete
                        message_queue.put({
                            'type': 'message_complete',
                            'data': {'session_id': session_id, 'content': full_response}
                        })
                        logger.error(f"✅ Sent message_complete event")
                        
                        # Reset prompt (like gui.py: prompt = None)
                        current_prompt = None
                        
                        # Check for reflection (like gui.py: if self.coder.reflected_message:) - CODE MODE ONLY
                        if coder.reflected_message:
                            logger.error(f"🤔 REFLECTION DETECTED!")
                            logger.error(f"   Reflection message: {coder.reflected_message}")
                            logger.error(f"   Current reflection count: {num_reflections}/{max_reflections}")
                            
                            if num_reflections < max_reflections:
                                num_reflections += 1
                                logger.error(f"✅ Proceeding with reflection {num_reflections} (gui.py style)")
                                
                                # Show reflection as info (like gui.py: self.info(self.coder.reflected_message))
                                message_queue.put({
                                    'type': 'reflection_info',
                                    'data': {
                                        'message': coder.reflected_message,
                                        'reflection_num': num_reflections,
                                        'session_id': session_id
                                    }
                                })
                                logger.error(f"📤 Sent reflection_info event")
                                
                                # Add reflection to session messages as info
                                if session_id in sessions:
                                    sessions[session_id]['messages'].append({
                                        'role': 'info', 
                                        'content': f"{coder.reflected_message}"
                                    })
                                    logger.error(f"💾 Added reflection to session messages")
                                
                                # Continue the loop with reflected message (like gui.py: prompt = self.coder.reflected_message)
                                current_prompt = coder.reflected_message
                                logger.error(f"🔄 Continuing loop with reflected message")
                            else:
                                # Hit reflection limit
                                logger.warning(f"⚠️ REFLECTION LIMIT REACHED ({max_reflections})")
                                message_queue.put({
                                    'type': 'reflection_limit',
                                    'data': {
                                        'message': f"Reached maximum reflections ({max_reflections})",
                                        'session_id': session_id
                                    }
                                })
                                logger.error(f"📤 Sent reflection_limit event")
                        else:
                            logger.error(f"✅ No reflection - conversation complete")
                    
                    logger.error(f"🏁 WHILE LOOP COMPLETED - no more prompts (CODE MODE)")
                    
                else:
                    # Simple single response for ASK/CONTEXT modes - no reflections
                    logger.error(f"📝 SIMPLE MODE ({current_mode.upper()}) - Single response only")
                    logger.error(f"   Initial prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}")
                    
                    # Stream the response once (no reflection loop)
                    full_response = ""
                    chunk_count = 0
                    logger.error(f"🌊 Starting single stream for {current_mode.upper()} mode...")
                    
                    for chunk in coder.run_stream(prompt):
                        # Check for cancellation before processing each chunk
                        if cancellation_requests.get(session_id, False):
                            logger.error(f"🚫 CANCELLATION DETECTED - stopping stream ({current_mode.upper()} MODE)")
                            message_queue.put({
                                'type': 'message_cancelled',
                                'data': {'session_id': session_id, 'message': 'Request cancelled by user'}
                            })
                            # Clear the cancellation flag
                            cancellation_requests[session_id] = False
                            return
                        
                        chunk_count += 1
                        full_response += chunk
                        
                        # Log first few chunks for debugging
                        if chunk_count <= 3:
                            logger.error(f"   Chunk {chunk_count}: {chunk[:50]}{'...' if len(chunk) > 50 else ''}")
                        
                        # Add chunk to the queue
                        message_queue.put({
                            'type': 'message_chunk',
                            'data': {'chunk': chunk, 'session_id': session_id}
                        })
                    
                    logger.error(f"🌊 Stream completed ({current_mode.upper()} mode):")
                    logger.error(f"   Total chunks: {chunk_count}")
                    logger.error(f"   Response length: {len(full_response)}")
                    
                    # Add the complete assistant message to session
                    if session_id in sessions:
                        sessions[session_id]['messages'].append({
                            'role': 'assistant', 
                            'content': full_response
                        })
                        logger.error(f"💾 Added assistant response to session messages")
                    
                    # Mark this response as complete
                    message_queue.put({
                        'type': 'message_complete',
                        'data': {'session_id': session_id, 'content': full_response}
                    })
                    logger.error(f"✅ Sent message_complete event")
                    
                    # Check for any reflections but ignore them for loop logic in ASK/CONTEXT modes
                    if coder.reflected_message:
                        logger.error(f"🚫 Reflection detected but IGNORED for loop in {current_mode.upper()} mode:")
                        logger.error(f"   Reflection message: {coder.reflected_message}")
                        
                        # Still show the reflection to the user as info
                        message_queue.put({
                            'type': 'reflection_info',
                            'data': {
                                'message': f"[{current_mode.upper()} Mode] {coder.reflected_message}",
                                'reflection_num': 1,
                                'session_id': session_id
                            }
                        })
                        logger.error(f"📤 Sent reflection_info event for {current_mode.upper()} mode")
                        
                        # Add reflection to session messages as info
                        if session_id in sessions:
                            sessions[session_id]['messages'].append({
                                'role': 'info', 
                                'content': f"🤔 AI Note ({current_mode.upper()} Mode): {coder.reflected_message}"
                            })
                            logger.error(f"💾 Added reflection to session messages")
                        
                        # Trigger a file refresh to get most updated information
                        logger.error(f"🔄 Triggering file refresh after reflection in {current_mode.upper()} mode")
                        message_queue.put({
                            'type': 'refresh_files',
                            'data': {
                                'mode': current_mode.upper(),
                                'session_id': session_id
                            }
                        })
                        logger.error(f"📤 Sent refresh_files event")
                    else:
                        logger.error(f"✅ No reflection - simple response complete")
                    
                    logger.error(f"🏁 SIMPLE MODE COMPLETED ({current_mode.upper()})")
                
                # After the conversation loop, check for edits and commits (like gui.py)
                logger.error(f"🔍 Checking for file edits and commits...")
                
                # Check for edits
                edited_files = getattr(coder, 'aider_edited_files', [])
                if edited_files:
                    logger.error(f"📝 Files edited: {list(edited_files)}")
                    message_queue.put({
                        'type': 'files_edited',
                        'data': {'files': list(edited_files), 'session_id': session_id}
                    })
                    logger.error(f"📤 Sent files_edited event")
                else:
                    logger.error(f"📝 No files were edited")
                
                # Check for commits (like gui.py edit logic)
                current_commit = getattr(coder, 'last_aider_commit_hash', None)
                session_commit = sessions[session_id].get('last_aider_commit_hash')
                
                logger.error(f"🔍 Commit check:")
                logger.error(f"   Session commit: {session_commit}")
                logger.error(f"   Current commit: {current_commit}")
                
                if session_commit != current_commit and current_commit:
                    logger.error(f"📝 NEW COMMIT DETECTED: {current_commit}")
                    try:
                        commits = f"{current_commit}~1"
                        diff = coder.repo.diff_commits(
                            coder.pretty,
                            commits,
                            current_commit,
                        )
                        
                        commit_msg = getattr(coder, 'last_aider_commit_message', '')
                        logger.error(f"   Commit message: {commit_msg}")
                        logger.error(f"   Diff length: {len(diff) if diff else 0}")
                        
                        message_queue.put({
                            'type': 'commit',
                            'data': {
                                'hash': current_commit,
                                'message': commit_msg,
                                'diff': diff,
                                'session_id': session_id
                            }
                        })
                        
                        sessions[session_id]['last_aider_commit_hash'] = current_commit
                        logger.error(f"📤 Sent commit event and updated session")
                    except Exception as commit_error:
                        logger.error(f"❌ Error processing commit: {commit_error}")
                else:
                    logger.error(f"📝 No new commits")
                
                # Save session after processing
                if session_id in sessions:
                    save_session(session_id, sessions[session_id])
                    logger.error(f"💾 Final session save completed")
                
                logger.error("🔄 " + "="*50)
                logger.error("🔄 PROCESS_CHAT THREAD COMPLETED SUCCESSFULLY (GUI.PY STYLE)")
                logger.error("🔄 " + "="*50)
                
            except Exception as e:
                logger.error("💥 " + "="*50)
                logger.error("💥 ERROR IN PROCESS_CHAT THREAD")
                logger.error("💥 " + "="*50)
                logger.error(f"Error: {str(e)}")
                logger.error(f"Traceback:\n{traceback.format_exc()}")
                
                # Add error to queue
                if session_id in message_queues:
                    message_queues[session_id].put({
                        'type': 'error',
                        'data': {'message': str(e), 'session_id': session_id}
                    })
                    logger.error(f"📤 Sent error event to client")
        
        # Create and start thread
        logger = logging.getLogger(__name__)
        logger.error(f"🧵 Creating background thread for process_chat (gui.py style)")
        thread = threading.Thread(target=run_stream)
        thread.daemon = True
        thread.start()
        logger.error(f"🧵 Background thread started successfully")
        return True

    @staticmethod
    def scrape_url(url):
        """Scrape content from a URL"""
        scraper = Scraper(print_error=lambda x: x)
        return scraper.scrape(url)

# Modify get_or_create_session function
def get_or_create_session(session_id, create=True):
    """Get or create a session by ID"""
    logger = logging.getLogger(__name__)
    
    logger.debug(f"get_or_create_session called with ID: {session_id}")
    logger.debug(f"Current sessions: {list(sessions.keys())}")
    
    # Check if we're waiting for project selection
    wait_for_project = os.environ.get('NEWREV_WAIT_FOR_PROJECT', 'false').lower() == 'true'
    
    if session_id not in sessions and create:
        logger.debug(f"Creating new session for ID: {session_id}")
        
        if wait_for_project:
            # Create a minimal session without coder - waiting for project selection
            logger.debug("Creating minimal session - waiting for project selection")
            sessions[session_id] = {
                'coder': None,
                'messages': [
                    {'role': 'info', 'content': 'Welcome to NewRev! Please select a project directory to get started.'},
                    {'role': 'assistant', 'content': 'Select a Git repository to begin coding with AI assistance.'}
                ],
                'files': [],
                'last_aider_commit_hash': None,
                'input_history': [],
                'created_at': time.time(),
                'waiting_for_project': True
            }
            logger.debug("Created minimal session waiting for project selection")
            return sessions[session_id]
        
        try:
            # Try to load existing session data
            saved_data = load_session(session_id)
            
            coder = AiderAPI.initialize_coder()
            logger.debug("Coder initialized successfully")
            
            # Get initial files before creating session
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            logger.debug(f"Found files - All: {all_files}, InChat: {inchat_files}")
            
            # Create session with saved data or defaults
            sessions[session_id] = {
                'coder': coder,
                'messages': saved_data['messages'] if saved_data else [],
                'files': saved_data['files'] if saved_data else inchat_files,
                'last_aider_commit_hash': saved_data['last_aider_commit_hash'] if saved_data else coder.last_aider_commit_hash,
                'input_history': saved_data['input_history'] if saved_data else list(coder.io.get_input_history()),
                'created_at': saved_data['created_at'] if saved_data else time.time()
            }
            
            # Add initialization announcements only if no messages exist
            if not saved_data:
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
            
            # Save the session
            save_session(session_id, sessions[session_id])
            
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    else:
        logger.debug(f"Using existing session: {session_id}")
    
    return sessions.get(session_id)

# Routes
@app.route('/api/init', methods=['POST'])
def initialize_session():
    """Initialize a new session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session = get_or_create_session(session_id)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Failed to create session'}), 500
    
    return jsonify({
        'status': 'success',
        'messages': session['messages'],
        'files': session['files']
    })

# Modify send_message endpoint to save session after each message
@app.route('/api/send_message', methods=['POST'])
def send_message():
    """Send a message to the aider coder"""
    data = request.json
    session_id = data.get('session_id')
    message = data.get('message')
    
    if not session_id or not message:
        return jsonify({'status': 'error', 'message': 'Session ID and message are required'}), 400
    
    session = get_or_create_session(session_id)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Failed to create session'}), 500
    
    coder = session['coder']
    
    # Add message to history
    session['messages'].append({'role': 'user', 'content': message})
    coder.io.add_to_input_history(message)
    session['input_history'].append(message)
    
    # Save session after adding message
    save_session(session_id, session)
    
    # Process message asynchronously
    AiderAPI.process_chat(coder, message, session_id)
    
    return jsonify({'status': 'success'})

@app.route('/api/cancel_message', methods=['POST'])
def cancel_message():
    """Cancel an ongoing message processing for a session"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'status': 'error', 'message': 'session_id is required'}), 400
        
        # Set cancellation flag for the session
        cancellation_requests[session_id] = True
        logger = logging.getLogger(__name__)
        logger.error(f"🚫 CANCELLATION REQUESTED for session: {session_id}")
        
        return jsonify({'status': 'success', 'message': 'Cancellation request sent'})
        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error cancelling message: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
        session = get_or_create_session(session_id)
        
        if not session:
            logger.error(f"No session found for ID: {session_id}")
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404
        
        logger.debug("Session retrieved successfully")
        coder = session['coder']
        
        try:
            # Force refresh the coder's file cache to pick up any new/deleted files
            if hasattr(coder, 'repo') and coder.repo:
                # Refresh the repository to pick up new files
                try:
                    coder.repo.refresh_aider_ignore()
                except AttributeError:
                    # If refresh method doesn't exist, that's ok
                    pass
            
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            logger.debug(f"Files retrieved - All: {len(all_files)} files, InChat: {len(inchat_files)} files")
            
            response = {
                'status': 'success',
                'all_files': all_files,
                'inchat_files': inchat_files
            }
            
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

@app.route('/api/refresh_files', methods=['POST'])
def refresh_files():
    """Refresh and get all files and in-chat files - more explicit refresh endpoint"""
    logger = logging.getLogger(__name__)
    logger.debug("refresh_files endpoint called")
    
    try:
        data = request.json
        session_id = data.get('session_id')
        
        if not session_id:
            logger.error("No session ID provided")
            return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
        
        session = get_or_create_session(session_id)
        
        if not session:
            logger.error(f"No session found for ID: {session_id}")
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404
        
        coder = session['coder']
        
        if not coder:
            logger.error("No coder instance in session")
            return jsonify({'status': 'error', 'message': 'No active project'}), 400
        
        try:
            # Force refresh the coder's file scanning
            if hasattr(coder, 'repo') and coder.repo:
                try:
                    # Clear any cached file lists
                    coder.repo.refresh_aider_ignore()
                    logger.debug("Refreshed aider ignore patterns")
                except AttributeError:
                    logger.debug("refresh_aider_ignore method not available")
                    pass
                
                # Force re-scan the working directory
                try:
                    if hasattr(coder.repo, 'get_tracked_files'):
                        coder.repo.get_tracked_files.cache_clear()
                        logger.debug("Cleared tracked files cache")
                except AttributeError:
                    pass
            
            # Get fresh file lists
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            logger.debug(f"Refreshed files - All: {len(all_files)} files, InChat: {len(inchat_files)} files")
            
            response = {
                'status': 'success',
                'all_files': all_files,
                'inchat_files': inchat_files,
                'message': 'Files refreshed successfully'
            }
            
            return jsonify(response)
            
        except Exception as e:
            logger.error(f"Error refreshing files: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                'status': 'error',
                'message': f'Error refreshing files: {str(e)}'
            }), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in refresh_files: {str(e)}")
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
    
    session = get_or_create_session(session_id)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Failed to create session'}), 500
    
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
    
    session = get_or_create_session(session_id)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Failed to create session'}), 500
    
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
    
    session = get_or_create_session(session_id)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Failed to create session'}), 500
    
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
    
    session = get_or_create_session(session_id)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Failed to create session'}), 500
    
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

# Modify clear_history endpoint to save session after clearing
@app.route('/api/clear_history', methods=['POST'])
def clear_history():
    """Clear chat history"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
    
    session = get_or_create_session(session_id)
    
    if not session:
        return jsonify({'status': 'error', 'message': 'Failed to create session'}), 500
    
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
    
    # Save session after clearing history
    save_session(session_id, session)
    
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
    full_path = os.path.join(repo.working_tree_dir, file_name)
    
    if not os.path.exists(full_path):
        return jsonify({'status': 'error', 'message': f'File {file_name} not found in repository'}), 404
    
    try:
        # Check if the file is binary
        text_extensions = {'.txt', '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.css', '.html', '.yml', '.yaml', '.env', '.sh', '.bash', '.zsh', '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc'}
        is_binary = not any(full_path.lower().endswith(ext) for ext in text_extensions)
        
        if is_binary:
            # For binary files, return a message indicating it's a binary file
            return jsonify({
                'status': 'success',
                'file_content': '[Binary file content not displayed]',
                'is_binary': True
            })
        
        # For text files, read and return the content
        with open(full_path, 'r', encoding='utf-8') as f:
            file_content = f.read()
        
        return jsonify({
            'status': 'success',
            'file_content': file_content,
            'is_binary': False
        })
    except Exception as e:
        print(f"Error reading file: {str(e)}")
        return jsonify({'status': 'error', 'message': f'Error reading file: {str(e)}'}), 500

@app.route('/api/run_command', methods=['POST'])
def run_command():
    """Run a shell command and return the output"""
    try:
        data = request.get_json()
        if not data or 'command' not in data:
            return jsonify({'error': 'No command provided'}), 400

        command = data['command']
        session_id = data.get('session_id')
        
        # Get or create session
        session = get_or_create_session(session_id)
        if not session:
            return jsonify({'error': 'Invalid session'}), 400

        # Get the coder instance
        coder = session.get('coder')
        if not coder:
            return jsonify({'error': 'No coder instance found'}), 400

        # Run the command using aider's run_cmd
        exit_status, output = run_cmd(
            command,
            verbose=False,
            error_print=None,
            cwd=coder.root
        )

        # Format the response
        response = {
            'exit_status': exit_status,
            'output': output,
            'success': exit_status == 0
        }

        # If the command failed, add error context
        if exit_status != 0:
            response['error'] = f'Command failed with exit status {exit_status}'

        return jsonify(response)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/set_mode', methods=['POST'])
def set_mode():
    """Set the mode for the current session"""
    logger = logging.getLogger(__name__)
    logger.error("🎯 " + "="*50)
    logger.error("🎯 SET_MODE ENDPOINT CALLED")
    logger.error("🎯 " + "="*50)
    
    try:
        data = request.json
        session_id = data.get('session_id')
        mode = data.get('mode')
        architect_model = data.get('architect_model')
        reasoning_effort = data.get('reasoning_effort')
        thinking_tokens = data.get('thinking_tokens')
        
        logger.error(f"🎯 Mode Change Request:")
        logger.error(f"   Session ID: {session_id}")
        logger.error(f"   New Mode: {mode}")
        logger.error(f"   Architect Model: {architect_model}")
        logger.error(f"   Reasoning Effort: {reasoning_effort}")
        logger.error(f"   Thinking Tokens: {thinking_tokens}")
        
        if not session_id:
            logger.error("No session ID provided")
            return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
            
        if not mode:
            logger.error("No mode provided")
            return jsonify({'status': 'error', 'message': 'Mode is required'}), 400
        
        # Validate mode
        valid_modes = ['code', 'architect', 'ask', 'context']
        if mode not in valid_modes:
            logger.error(f"Invalid mode: {mode}")
            return jsonify({
                'status': 'error', 
                'message': f'Invalid mode {mode}. Must be one of: {", ".join(valid_modes)}'
            }), 400
        
        # Get session
        session = get_or_create_session(session_id)
        if not session:
            logger.error(f"No session found for ID: {session_id}")
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404
        
        # Get current coder
        current_coder = session['coder']
        
        # Log current coder properties before mode change
        log_coder_properties(current_coder, f"BEFORE MODE CHANGE to {mode}")
        
        # Prepare kwargs for new coder
        summarize_from_coder = True
        edit_format = mode

        if mode == "code":
            edit_format = current_coder.main_model.edit_format
            summarize_from_coder = False
        elif mode == "ask":
            summarize_from_coder = False

        kwargs = {
            'edit_format': edit_format,
            'from_coder': current_coder,
            'summarize_from_coder': summarize_from_coder,
        }
        
        # Add architect model if provided and in architect mode
        if mode == 'architect' and architect_model:
            kwargs['architect_model'] = architect_model
            
        # Add reasoning effort if provided
        if reasoning_effort is not None:
            kwargs['reasoning_effort'] = float(reasoning_effort)
            
        # Add thinking tokens if provided
        if thinking_tokens is not None:
            kwargs['thinking_tokens'] = int(thinking_tokens)
        
        # Create new coder with updated configuration
        try:
            io = AiderAPI.CaptureIO(
                pretty=False,
                yes=True,
                dry_run=current_coder.io.dry_run,
                encoding=current_coder.io.encoding,
            )
            new_coder =  Coder.create(
                from_coder=current_coder,
                main_model=current_coder.main_model,
                edit_format=edit_format,
                summarize_from_coder=False)
            
            # Log new coder properties after creation
            log_coder_properties(new_coder, f"NEW CODER CREATED with mode {mode}")
            
            new_coder.commands.io = io
            
            # Force the coder to cooperate, regardless of cmd line args
            new_coder.yield_stream = True
            new_coder.stream = True
            new_coder.pretty = False
        
        except Exception as e:
            logger.error(f"Failed to initialize new coder: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': f'Failed to switch mode: {str(e)}'
            }), 500
        
        # Update session with new coder
        session['coder'] = new_coder
        
        # Log final coder properties after mode change
        log_coder_properties(session['coder'], f"FINAL SESSION CODER after {mode}")
        
        # Add mode switch message to history
        mode_switch_message = f'Switched to {mode} mode'
        if mode == 'architect' and architect_model:
            mode_switch_message += f' with model {architect_model}'
        if reasoning_effort is not None:
            mode_switch_message += f', reasoning effort {reasoning_effort}'
        if thinking_tokens is not None:
            mode_switch_message += f', thinking tokens {thinking_tokens}'
            
        session['messages'].append({
            'role': 'info',
            'content': mode_switch_message
        })
        
        # Get announcements from new coder
        announcements = new_coder.get_announcements()
        if announcements:
            session['messages'].append({
                'role': 'info',
                'content': '\n'.join(announcements)
            })
        
        logger.error("🎯 " + "="*50)
        logger.error("🎯 SET_MODE COMPLETED SUCCESSFULLY")
        logger.error("🎯 " + "="*50)
        
        return jsonify({
            'status': 'success',
            'mode': mode,
            'message': mode_switch_message,
            'announcements': announcements
        })
            
    except Exception as e:
        logger.error(f"Unexpected error in set_mode: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/api/initialize_project', methods=['POST'])
def initialize_project():
    """Initialize project with directory and API keys"""
    logger = logging.getLogger(__name__)
    logger.debug("initialize_project endpoint called")
    
    try:
        data = request.json
        session_id = data.get('session_id')
        project_path = data.get('project_path')
        api_keys = data.get('api_keys', {})
        model = data.get('model')
        
        logger.debug(f"Initialize project - Session: {session_id}, Path: {project_path}, Model: {model}")
        
        if not session_id or not project_path:
            logger.error("Session ID and project path are required")
            return jsonify({'status': 'error', 'message': 'Session ID and project path are required'}), 400
        
        # Validate project path
        if not os.path.exists(project_path):
            logger.error(f"Project path does not exist: {project_path}")
            return jsonify({'status': 'error', 'message': f'Project path does not exist: {project_path}'}), 400
        
        # Verify it's a git repository
        try:
            from git import Repo
            repo = Repo(project_path, search_parent_directories=False)
            logger.debug(f"Verified git repository at: {project_path}")
        except Exception as e:
            logger.error(f"Not a git repository: {project_path}")
            return jsonify({'status': 'error', 'message': f'Not a git repository: {project_path}'}), 400
        
        # Store original working directory and change temporarily
        original_cwd = os.getcwd()
        try:
            os.chdir(project_path)
            logger.debug(f"Changed working directory to: {project_path}")
            # Set environment variables for API keys
            for key, value in api_keys.items():
                if value:
                    os.environ[key] = value
                    logger.debug(f"Set environment variable: {key}")
            
            # Build arguments for coder initialization
            args = ['--no-show-model-warnings']  # Suppress model warnings
            if model:
                args.extend(['--model', model])
                logger.debug(f"Using model: {model}")
            else:
                # Use a default model that doesn't require API keys for initial setup
                args.extend(['--model', 'gpt-3.5-turbo'])
                logger.debug("Using default model: gpt-3.5-turbo")
            
            # Create new session with project-specific coder
            if session_id in sessions:
                del sessions[session_id]  # Remove old session
            
            # Initialize new coder in the project directory
            logger.debug(f"Initializing coder with args: {args}")
            coder = AiderAPI.initialize_coder(args)
            logger.debug("Coder initialized successfully")
            
            # Get files from the new project
            all_files = coder.get_all_relative_files()
            inchat_files = coder.get_inchat_relative_files()
            
            # Create new session
            sessions[session_id] = {
                'coder': coder,
                'messages': [],
                'files': inchat_files,
                'last_aider_commit_hash': coder.last_aider_commit_hash,
                'input_history': list(coder.io.get_input_history()),
                'created_at': time.time(),
                'project_path': project_path,
                'api_keys': api_keys,
                'model': model
            }
            
            # Add initial messages
            announcements = AiderAPI.get_announcements(coder)
            sessions[session_id]['messages'].append({
                'role': 'info', 
                'content': '\n'.join(announcements)
            })
            sessions[session_id]['messages'].append({
                'role': 'assistant', 
                'content': f'Project initialized at {project_path}. How can I help you?'
            })
            
            # Save session
            save_session(session_id, sessions[session_id])
            
            return jsonify({
                'status': 'success',
                'message': f'Project initialized at {project_path}',
                'project_path': project_path,
                'files': {
                    'all_files': all_files,
                    'inchat_files': inchat_files
                },
                'file_count': len(all_files)
            })
            
        except Exception as e:
            logger.error(f"Failed to initialize project: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return jsonify({
                'status': 'error',
                'message': f'Failed to initialize project: {str(e)}'
            }), 500
        finally:
            # Always restore original working directory
            os.chdir(original_cwd)
            logger.debug(f"Restored working directory to: {original_cwd}")
            
    except Exception as e:
        logger.error(f"Unexpected error in initialize_project: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Unexpected error: {str(e)}'
        }), 500

@app.route('/api/update_api_keys', methods=['POST'])
def update_api_keys():
    """Update API keys for the current session"""
    logger = logging.getLogger(__name__)
    logger.debug("update_api_keys endpoint called")
    
    try:
        data = request.json
        session_id = data.get('session_id')
        api_keys = data.get('api_keys', {})
        
        if not session_id:
            logger.error("Session ID is required")
            return jsonify({'status': 'error', 'message': 'Session ID is required'}), 400
        
        session = sessions.get(session_id)
        if not session:
            logger.error(f"Session not found: {session_id}")
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404
        
        # Update environment variables
        for key, value in api_keys.items():
            if value:
                os.environ[key] = value
                logger.debug(f"Updated environment variable: {key}")
            elif key in os.environ:
                del os.environ[key]
                logger.debug(f"Removed environment variable: {key}")
        
        # Update session data
        session['api_keys'] = api_keys
        save_session(session_id, session)
        
        return jsonify({
            'status': 'success',
            'message': 'API keys updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error updating API keys: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Error updating API keys: {str(e)}'
        }), 500

@app.route('/api/update_model', methods=['POST'])
def update_model():
    """Update the model for the current session"""
    logger = logging.getLogger(__name__)
    logger.error("🤖 " + "="*50)
    logger.error("🤖 UPDATE_MODEL ENDPOINT CALLED")
    logger.error("🤖 " + "="*50)
    
    try:
        data = request.json
        session_id = data.get('session_id')
        model = data.get('model')
        
        logger.error(f"🤖 Model Change Request:")
        logger.error(f"   Session ID: {session_id}")
        logger.error(f"   New Model: {model}")
        
        if not session_id or not model:
            logger.error("Session ID and model are required")
            return jsonify({'status': 'error', 'message': 'Session ID and model are required'}), 400
        
        session = sessions.get(session_id)
        if not session:
            logger.error(f"Session not found: {session_id}")
            return jsonify({'status': 'error', 'message': 'Session not found'}), 404
        
        current_coder = session['coder']
        
        # Log current coder properties before model change
        log_coder_properties(current_coder, f"BEFORE MODEL CHANGE to {model}")
        
        try:
            # Create new coder with updated model
            args = ['--model', model]
            
            # Get project path for working directory
            project_path = session.get('project_path', os.getcwd())
            original_cwd = os.getcwd()
            
            # Ensure we're in the right directory
            if project_path != original_cwd:
                os.chdir(project_path)
            
            try:
                # Initialize new coder with the new model
                new_coder = AiderAPI.initialize_coder(args)
                
                # Log new coder properties after creation
                log_coder_properties(new_coder, f"NEW CODER CREATED with model {model}")
                
                # Copy file state from old coder
                logger.error(f"🔄 Copying {len(current_coder.get_inchat_relative_files())} files from old coder")
                for fname in current_coder.get_inchat_relative_files():
                    logger.error(f"   Adding file: {fname}")
                    new_coder.add_rel_fname(fname)
                
                # Log coder properties after copying files
                log_coder_properties(new_coder, f"AFTER COPYING FILES to {model}")
                
                # Update session with new coder
                session['coder'] = new_coder
                session['model'] = model
                
                # Log final coder properties after model change
                log_coder_properties(session['coder'], f"FINAL SESSION CODER with model {model}")
                
                # Add info message
                session['messages'].append({
                    'role': 'info',
                    'content': f'Switched to model: {model}'
                })
                
                # Save session
                save_session(session_id, session)
                
                logger.error("🤖 " + "="*50)
                logger.error("🤖 UPDATE_MODEL COMPLETED SUCCESSFULLY")
                logger.error("🤖 " + "="*50)
                
                return jsonify({
                    'status': 'success',
                    'message': f'Successfully switched to model: {model}',
                    'model': model
                })
                
            finally:
                # Restore working directory
                if project_path != original_cwd:
                    os.chdir(original_cwd)
                
        except Exception as e:
            logger.error(f"Failed to switch model: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': f'Failed to switch model: {str(e)}'
            }), 500
            
    except Exception as e:
        logger.error(f"Error updating model: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Error updating model: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'success',
        'message': 'API is running',
        'timestamp': time.time()
    })

@app.route('/api/get_available_models', methods=['GET'])
def get_available_models():
    """Get list of available models and their aliases"""
    try:
        # Import the models module to get available models
        from aider.models import MODEL_ALIASES
        
        # Get model aliases
        aliases = {}
        for alias, model_name in MODEL_ALIASES.items():
            aliases[alias] = model_name
        
        # Add some common model examples
        common_models = {
            "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku": "claude-3-5-haiku-20241022", 
            "claude-3-opus": "claude-3-opus-20240229",
            "gpt-4o": "gpt-4o",
            "gpt-4o-mini": "gpt-4o-mini",
            "gpt-3.5-turbo": "gpt-3.5-turbo",
            "deepseek-chat": "deepseek/deepseek-chat",
            "deepseek-coder": "deepseek/deepseek-coder",
            "gemini-2.0-flash": "openrouter/google/gemini-2.0-flash-exp",
        }
        
        return jsonify({
            'status': 'success',
            'aliases': aliases,
            'common_models': common_models
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving models: {str(e)}'
        }), 500

def log_coder_properties(coder, context="Unknown"):
    """Log detailed coder properties for debugging"""
    logger = logging.getLogger(__name__)
    logger.error(f"🔍 CODER PROPERTIES - {context}")
    logger.error(f"   Instance ID: {id(coder)}")
    logger.error(f"   Type: {type(coder)}")
    logger.error(f"   Main Model: {getattr(coder, 'main_model', 'None')}")
    logger.error(f"   Edit Format: {getattr(coder, 'edit_format', 'None')}")
    logger.error(f"   Stream: {getattr(coder, 'stream', 'None')}")
    logger.error(f"   Yield Stream: {getattr(coder, 'yield_stream', 'None')}")
    logger.error(f"   Pretty: {getattr(coder, 'pretty', 'None')}")
    logger.error(f"   Chat Language: {getattr(coder, 'chat_language', 'None')}")
    
    # Reflection properties (most important)
    logger.error(f"   🔄 REFLECTION STATE:")
    logger.error(f"      Has reflected_message: {hasattr(coder, 'reflected_message')}")
    logger.error(f"      Reflected_message: {getattr(coder, 'reflected_message', 'None')}")
    logger.error(f"      Num reflections: {getattr(coder, 'num_reflections', 'N/A')}")
    logger.error(f"      Max reflections: {getattr(coder, 'max_reflections', 'N/A')}")
    
    # File state
    logger.error(f"   📁 FILE STATE:")
    logger.error(f"      Files in chat: {len(coder.get_inchat_relative_files()) if hasattr(coder, 'get_inchat_relative_files') else 'N/A'}")
    logger.error(f"      Chat files: {list(coder.get_inchat_relative_files()) if hasattr(coder, 'get_inchat_relative_files') else 'N/A'}")
    
    # Safe handling of aider_edited_files
    aider_edited_files = getattr(coder, 'aider_edited_files', [])
    logger.error(f"      Aider edited files: {aider_edited_files if aider_edited_files else []}")
    
    # Git/Repo state
    logger.error(f"   🗂️ GIT STATE:")
    logger.error(f"      Last commit: {getattr(coder, 'last_aider_commit_hash', 'None')}")
    logger.error(f"      Last commit message: {getattr(coder, 'last_aider_commit_message', 'None')}")
    logger.error(f"      Repo path: {coder.repo.repo.git_dir if hasattr(coder, 'repo') and coder.repo else 'None'}")
    
    # Message state
    logger.error(f"   💬 MESSAGE STATE:")
    done_messages = getattr(coder, 'done_messages', [])
    cur_messages = getattr(coder, 'cur_messages', [])
    logger.error(f"      Done messages count: {len(done_messages) if done_messages else 0}")
    logger.error(f"      Cur messages count: {len(cur_messages) if cur_messages else 0}")
    logger.error(f"      Partial response content: {bool(getattr(coder, 'partial_response_content', ''))}")
    logger.error(f"      Multi response content: {bool(getattr(coder, 'multi_response_content', ''))}")
    
    # Conversation context (most important for debugging)
    logger.error(f"   📚 CONVERSATION CONTEXT:")
    if done_messages:
        logger.error(f"      Done messages ({len(done_messages)} total):")
        for i, msg in enumerate(done_messages[-3:], 1):  # Show last 3 messages
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')
            if content:
                # Truncate long content for readability
                preview = content[:100] + "..." if len(content) > 100 else content
                logger.error(f"         {i}. [{role.upper()}] {preview}")
            else:
                logger.error(f"         {i}. [{role.upper()}] <empty content>")
    else:
        logger.error(f"      Done messages: None/empty")
    
    if cur_messages:
        logger.error(f"      Current messages ({len(cur_messages)} total):")
        for i, msg in enumerate(cur_messages, 1):
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')
            if content:
                # Truncate long content for readability
                preview = content[:100] + "..." if len(content) > 100 else content
                logger.error(f"         {i}. [{role.upper()}] {preview}")
            else:
                logger.error(f"         {i}. [{role.upper()}] <empty content>")
    else:
        logger.error(f"      Current messages: None/empty")
    
    # IO and Commands
    logger.error(f"   🔧 IO & COMMANDS:")
    logger.error(f"      IO type: {type(getattr(coder, 'io', 'None'))}")
    logger.error(f"      Commands IO type: {type(getattr(coder.commands, 'io', 'None')) if hasattr(coder, 'commands') else 'N/A'}")
    
    # Auto settings
    logger.error(f"   ⚙️ AUTO SETTINGS:")
    logger.error(f"      Auto commits: {getattr(coder, 'auto_commits', 'N/A')}")
    logger.error(f"      Auto lint: {getattr(coder, 'auto_lint', 'N/A')}")
    logger.error(f"      Auto test: {getattr(coder, 'auto_test', 'N/A')}")
    logger.error(f"      Auto copy context: {getattr(coder, 'auto_copy_context', 'N/A')}")
    logger.error(f"      Auto accept architect: {getattr(coder, 'auto_accept_architect', 'N/A')}")
    
    # Error tracking
    logger.error(f"   ⚠️ ERROR TRACKING:")
    logger.error(f"      Num exhausted context windows: {getattr(coder, 'num_exhausted_context_windows', 'N/A')}")
    logger.error(f"      Num malformed responses: {getattr(coder, 'num_malformed_responses', 'N/A')}")
    
    # Cost tracking
    logger.error(f"   💰 COST TRACKING:")
    logger.error(f"      Message cost: {getattr(coder, 'message_cost', 'N/A')}")
    logger.error(f"      Total cost: {getattr(coder, 'total_cost', 'N/A')}")
    logger.error(f"      Message tokens sent: {getattr(coder, 'message_tokens_sent', 'N/A')}")
    logger.error(f"      Message tokens received: {getattr(coder, 'message_tokens_received', 'N/A')}")

def log_coder_properties_simple(coder, context="Unknown"):
    """Log basic coder properties for quick reference"""
    logger = logging.getLogger(__name__)
    logger.error(f"🔍 CODER BASIC - {context}")
    logger.error(f"   Instance ID: {id(coder)}")
    logger.error(f"   Type: {type(coder)}")
    logger.error(f"   Main Model: {getattr(coder, 'main_model', 'None')}")
    logger.error(f"   Edit Format: {getattr(coder, 'edit_format', 'None')}")
    logger.error(f"   Chat Language: {getattr(coder, 'chat_language', 'None')}")
    
    # Most important reflection properties
    logger.error(f"   🔄 Reflection: {getattr(coder, 'reflected_message', 'None')}")
    logger.error(f"   🔄 Num reflections: {getattr(coder, 'num_reflections', 'N/A')}/{getattr(coder, 'max_reflections', 'N/A')}")
    
    # File and message state
    logger.error(f"   📁 Files in chat: {len(coder.get_inchat_relative_files()) if hasattr(coder, 'get_inchat_relative_files') else 'N/A'}")
    
    # Safe handling of lists that might be None
    done_messages = getattr(coder, 'done_messages', [])
    cur_messages = getattr(coder, 'cur_messages', [])
    aider_edited_files = getattr(coder, 'aider_edited_files', [])
    
    logger.error(f"   💬 Messages: {len(done_messages) if done_messages else 0} done, {len(cur_messages) if cur_messages else 0} current")
    logger.error(f"   📝 Edited files: {len(aider_edited_files) if aider_edited_files else 0}")
    logger.error(f"   🗂️ Last commit: {getattr(coder, 'last_aider_commit_hash', 'None')}")
    
    # Quick conversation context
    logger.error(f"   📚 Last conversation:")
    if done_messages and len(done_messages) > 0:
        last_msg = done_messages[-1]
        role = last_msg.get('role', 'unknown')
        content = last_msg.get('content', '')
        if content:
            preview = content[:80] + "..." if len(content) > 80 else content
            logger.error(f"      Last [{role.upper()}]: {preview}")
        else:
            logger.error(f"      Last [{role.upper()}]: <empty>")
    else:
        logger.error(f"      No conversation history")
    
    if cur_messages and len(cur_messages) > 0:
        current_msg = cur_messages[-1]
        role = current_msg.get('role', 'unknown')
        content = current_msg.get('content', '')
        if content:
            preview = content[:80] + "..." if len(content) > 80 else content
            logger.error(f"      Current [{role.upper()}]: {preview}")
        else:
            logger.error(f"      Current [{role.upper()}]: <empty>")

def main():
    """
    Main function to start the Aider API server.
    This function will be called by the 'newrev-api' console script.
    """
    print("=== Starting Aider API Server ===")
    
    # Check if we should wait for project selection
    wait_for_project = os.environ.get('NEWREV_WAIT_FOR_PROJECT', 'false').lower() == 'true'
    project_path = os.environ.get('NEWREV_PROJECT_PATH', '')
    
    if wait_for_project:
        print("Waiting for project selection - git repository check skipped")
    else:
        # Get the directory where the user ran 'newrev-api' or use provided project path
        current_working_directory = project_path or os.getcwd()
        print(f"Current working directory: {current_working_directory}")
        
        # Change to the project directory if provided
        if project_path and os.path.exists(project_path):
            os.chdir(project_path)
            print(f"Changed working directory to: {project_path}")
        
        # Check if we're in a git repo
        try:
            from git import Repo
            # Search for a git repo from the current working directory
            repo = Repo(current_working_directory, search_parent_directories=True)
            print(f"Found git repository at: {repo.git_dir}")
        except Exception as e:
            if not wait_for_project:
                print(f"Failed to find git repository: {e}")
                print("The API server must be run from within a git repository. Exiting.")
                sys.exit(1) # Use sys.exit(1) for a clean exit on error
    
    # Run the server
    print("Starting Flask server...")
    
    # Check if we're running in Electron context (either waiting for project or with project path)
    is_electron_context = (
        os.environ.get('NEWREV_WAIT_FOR_PROJECT', 'false').lower() == 'true' or 
        os.environ.get('NEWREV_PROJECT_PATH', '') != ''
    )
    
    app.run(
        host='0.0.0.0',
        port=5000, # Ensure this matches CLIENT_PORT in install.sh if you intend to configure it there
        debug=True, # Set to False for production
        threaded=True,
        use_reloader=not is_electron_context  # Disable reloader in Electron to prevent restarts
    )

# This block ensures 'main()' is called when the script is run as an executable
# (e.g., via 'newrev-api' command)
if __name__ == '__main__':
    main()