#!/usr/bin/env python

import json
import time
import uuid
import requests
import socketio

# API configuration
API_BASE_URL = 'http://localhost:5000/api'
SESSION_ID = f"test_{uuid.uuid4()}"

# Initialize SocketIO client
sio = socketio.Client()

# Message collector for streaming responses
received_messages = []

@sio.event
def connect():
    print("Connected to SocketIO server!")

@sio.event
def disconnect():
    print("Disconnected from SocketIO server!")

@sio.on('message_chunk')
def on_message_chunk(data):
    if data['session_id'] == SESSION_ID:
        chunk = data['chunk']
        received_messages.append(chunk)
        print(chunk, end='', flush=True)

@sio.on('message_complete')
def on_message_complete(data):
    if data['session_id'] == SESSION_ID:
        print("\n--- Message Complete ---")

@sio.on('files_edited')
def on_files_edited(data):
    if data['session_id'] == SESSION_ID:
        print(f"\nFiles edited: {', '.join(data['files'])}")

@sio.on('commit')
def on_commit(data):
    if data['session_id'] == SESSION_ID:
        print(f"\nCommit: {data['hash']}")
        print(f"Message: {data['message']}")
        if data.get('diff'):
            print("\nDiff:")
            print(data['diff'])

def api_request(endpoint, method='GET', data=None):
    """Make an API request"""
    url = f"{API_BASE_URL}/{endpoint}"
    
    if method == 'GET':
        if data:
            response = requests.get(url, params=data)
        else:
            response = requests.get(url)
    else:  # POST
        response = requests.post(url, json=data)
    
    return response.json()

def init_session():
    """Initialize a new session"""
    print(f"Initializing session: {SESSION_ID}")
    return api_request('init', 'POST', {'session_id': SESSION_ID})

def send_message(message):
    """Send a message to Aider"""
    print(f"\nSending message: {message}")
    received_messages.clear()
    return api_request('send_message', 'POST', {'session_id': SESSION_ID, 'message': message})

def get_files():
    """Get all files and in-chat files"""
    return api_request('get_files', 'GET', {'session_id': SESSION_ID})

def add_files(files):
    """Add files to the chat"""
    return api_request('add_files', 'POST', {'session_id': SESSION_ID, 'files': files})

def main():
    # Connect to the SocketIO server
    try:
        sio.connect(API_BASE_URL.replace('/api', ''))
    except socketio.exceptions.ConnectionError:
        print("Failed to connect to SocketIO server. Make sure the API is running.")
        return
    
    try:
        # Initialize the session
        session_result = init_session()
        print(f"Session initialized: {session_result['status']}")
        
        if session_result['status'] == 'success':
            # Print initial messages
            for msg in session_result['messages']:
                print(f"[{msg['role']}] {msg['content']}")
            
            # Get available files
            files_result = get_files()
            print("\nAvailable files:")
            for file in files_result['all_files']:
                prefix = "* " if file in files_result['inchat_files'] else "  "
                print(f"{prefix}{file}")
            
            # Send a test message
            send_message("What files are available in this repository?")
            
            # Wait for the streaming to complete
            time.sleep(2)
            
            # Optional: Add a file to the chat
            if files_result['all_files'] and len(files_result['inchat_files']) < len(files_result['all_files']):
                # Find a file that's not in the chat yet
                new_file = next(f for f in files_result['all_files'] if f not in files_result['inchat_files'])
                print(f"\nAdding file to chat: {new_file}")
                add_result = add_files([new_file])
                print(f"File added: {add_result['status']}")
                
                # Ask about the newly added file
                send_message(f"Can you explain what the file {new_file} does?")
                
                # Wait for the streaming to complete
                time.sleep(5)
    
    finally:
        # Disconnect from the SocketIO server
        sio.disconnect()

if __name__ == "__main__":
    main() 