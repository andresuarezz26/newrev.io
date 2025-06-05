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
from dotenv import load_dotenv
import redis

# Add the parent directory to sys.path to be able to import aider modules
# sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from aider import urls
from aider.coders import Coder
from aider.dump import dump  # noqa: F401
from aider.io import InputOutput
from aider.main import main as cli_main
from aider.scrape import Scraper

# Initialize Redis client
# 'redis' is the service name we'll use in docker-compose.yml
# The Orchestrator will tell this worker which session it belongs to via env var.
r = redis.Redis(host=os.getenv('REDIS_HOST', 'redis'), port=6379, db=0)

# Global variable to hold the single coder instance for this worker
global worker_coder
worker_coder = None

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
    def initialize_coder(repo_path, llm_api_key, args=None): # <--- MODIFIED
        logger = logging.getLogger(__name__)
        logger.debug(f"\n=== Starting Coder Initialization in {repo_path} ===")

        # Set the LLM API key as an environment variable for Aider
        os.environ["ANTHROPIC_API_KEY"] = llm_api_key
        logger.debug("ANTHROPIC_API_KEY set from argument.")

        # Temporarily change directory to the repository for Aider to operate
        original_cwd = os.getcwd()
        try:
            os.chdir(repo_path)
            logger.debug(f"Changed current working directory to: {os.getcwd()}")

            # Aider's cli_main will now correctly find the repo
            # No need for explicit Repo(os.getcwd()) check here, Aider handles it.

            logger.debug("Creating coder instance...")
            coder = cli_main(argv=args, return_coder=True)
            logger.debug(f"Coder instance created: {type(coder)}")

            if not isinstance(coder, Coder):
                logger.error(f"Invalid coder type: {type(coder)}")
                raise ValueError(f"Invalid coder instance: {coder}")

            if not coder.repo:
                logger.error("No git repo found in coder instance")
                raise ValueError("Aider could not find a git repository at the specified path.")

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
        finally:
            # IMPORTANT: Change back to original CWD.
            # This ensures any code running outside the worker (e.g., orchestrator logic)
            # does not get affected by the worker's CWD change.
            os.chdir(original_cwd)
    
    @staticmethod
    def get_announcements(coder):
        """Get announcements from coder"""
        return coder.get_announcements()
    
    @staticmethod
    def process_chat(coder, prompt, session_id):
        def run_stream():
            try:
                output_channel = f"aider_output_{session_id}" # Define channel for this session

                # Process the prompt and stream response
                for chunk in coder.run_stream(prompt):
                    r.publish(output_channel, json.dumps({ # <--- REDIS PUBLISH
                        'type': 'message_chunk',
                        'data': {'chunk': chunk, 'session_id': session_id}
                    }))
                    time.sleep(0.01) # Small delay to avoid overwhelming Redis/network

                # Mark message as complete
                r.publish(output_channel, json.dumps({ # <--- REDIS PUBLISH
                    'type': 'message_complete',
                    'data': {'session_id': session_id}
                }))

                # Check for edits
                if coder.aider_edited_files:
                    r.publish(output_channel, json.dumps({ # <--- REDIS PUBLISH
                        'type': 'files_edited',
                        'data': {'files': list(coder.aider_edited_files), 'session_id': session_id}
                    }))

                # Check for commits (simplified for worker's perspective)
                # The orchestrator will eventually ask for diffs or get them from host
                if coder.last_aider_commit_hash:
                     r.publish(output_channel, json.dumps({ # <--- REDIS PUBLISH
                         'type': 'commit',
                         'data': {
                             'hash': coder.last_aider_commit_hash,
                             'message': coder.last_aider_commit_message,
                             'session_id': session_id
                         }
                     }))

            except Exception as e:
                print(f"Error in process_chat: {str(e)}")
                print(traceback.format_exc())
                # Publish error to Redis
                r.publish(output_channel, json.dumps({ # <--- REDIS PUBLISH
                    'type': 'error',
                    'data': {'message': str(e), 'session_id': session_id}
                }))

        # Create and start thread
        thread = threading.Thread(target=run_stream)
        thread.daemon = True
        thread.start()
        return True


# At the very end of aider_worker_backend.py
if __name__ == '__main__':
    print("=== Aider Worker Backend Starting ===")
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

    # Get session_id, repo_path, and LLM_API_KEY from environment variables
    # The Orchestrator will set these when launching the Docker container
    session_id = os.getenv("AIDER_SESSION_ID")
    repo_path = os.getenv("REPO_PATH")
    llm_api_key = os.getenv("LLM_API_KEY") # Use a more generic name

    if not session_id or not repo_path or not llm_api_key:
        print("Error: AIDER_SESSION_ID, REPO_PATH, and LLM_API_KEY environment variables are required.")
        sys.exit(1)

    print(f"Worker for session {session_id} initialized for repo: {repo_path}")

    try:
        # Initialize the coder for this specific repo
        worker_coder = AiderAPI.initialize_coder(repo_path=repo_path, llm_api_key=llm_api_key)

        # Send initial announcements to the orchestrator via Redis
        output_channel = f"aider_output_{session_id}"
        r.publish(output_channel, json.dumps({
            'type': 'info',
            'data': {'content': '\n'.join(worker_coder.get_announcements()), 'session_id': session_id}
        }))
        r.publish(output_channel, json.dumps({
            'type': 'assistant',
            'data': {'content': 'How can I help you?', 'session_id': session_id}
        }))

        # Now, subscribe to input prompts for this session
        pubsub = r.pubsub()
        input_channel = f"aider_input_{session_id}"
        pubsub.subscribe(input_channel)
        print(f"Listening for prompts on Redis channel: {input_channel}")

        for message in pubsub.listen():
            if message['type'] == 'message':
                data = json.loads(message['data'].decode('utf-8'))
                if data.get('type') == 'prompt':
                    prompt = data.get('data', {}).get('message')
                    print(f"Received prompt for session {session_id}: {prompt}")
                    AiderAPI.process_chat(worker_coder, prompt, session_id)
                elif data.get('type') == 'shutdown':
                    print(f"Shutdown signal received for session {session_id}. Exiting.")
                    break

    except Exception as e:
        print(f"Critical error in Aider worker: {e}")
        print(traceback.format_exc())
        # Notify Orchestrator of critical error
        r.publish(f"aider_output_{session_id}", json.dumps({
            'type': 'error',
            'data': {'message': f"Critical worker error: {str(e)}", 'session_id': session_id}
        }))
    finally:
        print(f"Aider Worker Backend for session {session_id} stopped.")