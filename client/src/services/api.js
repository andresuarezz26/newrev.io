import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
//const API_URL = process.env.REACT_APP_API_URL || 'https://c80f-190-99-186-105.ngrok-free.app/api';

const SESSION_ID = localStorage.getItem('sessionId') || `session_${uuidv4()}`;

// Store session ID for future use
if (!localStorage.getItem('sessionId')) {
  localStorage.setItem('sessionId', SESSION_ID);
}

// Event listeners
const eventListeners = {
  connected: [],
  message_chunk: [],
  message_complete: [],
  files_edited: [],
  commit: [],
  error: []
};

// Create EventSource for SSE
let eventSource = null;

// Function to connect to SSE stream
const connectToEventStream = () => {
  if (eventSource) {
    eventSource.close();
  }

  // Create new EventSource connection
  eventSource = new EventSource(`${API_URL}/stream?session_id=${SESSION_ID}`);
  
  // Set up event listeners
  eventSource.addEventListener('connected', (event) => {
    const data = JSON.parse(event.data);
    console.log('Connected to event stream:', data);
    
    // Notify listeners
    eventListeners.connected.forEach(listener => listener(data));
  });
  
  eventSource.addEventListener('message_chunk', (event) => {
    const data = JSON.parse(event.data);
    console.log('Received message chunk:', data);
    
    // Notify listeners
    eventListeners.message_chunk.forEach(listener => listener(data));
  });
  
  eventSource.addEventListener('message_complete', (event) => {
    const data = JSON.parse(event.data);
    console.log('Message complete:', data);
    
    // Notify listeners
    eventListeners.message_complete.forEach(listener => listener(data));
  });
  
  eventSource.addEventListener('files_edited', (event) => {
    const data = JSON.parse(event.data);
    console.log('Files edited:', data);
    
    // Notify listeners
    eventListeners.files_edited.forEach(listener => listener(data));
  });
  
  eventSource.addEventListener('commit', (event) => {
    const data = JSON.parse(event.data);
    console.log('Commit:', data);
    
    // Notify listeners
    eventListeners.commit.forEach(listener => listener(data));
  });
  
  eventSource.addEventListener('error', (event) => {
    let data;
    
    try {
      data = JSON.parse(event.data);
      console.error('Error from server:', data);
    } catch (e) {
      data = { message: 'Connection error' };
      console.error('EventSource error:', e);
    }
    
    // Notify listeners
    eventListeners.error.forEach(listener => listener(data));
  });
  
  eventSource.onerror = (error) => {
    console.error('EventSource error:', error);
    
    // Attempt to reconnect after a delay if connection was lost
    if (eventSource.readyState === EventSource.CLOSED) {
      console.log('Reconnecting to event stream in 3 seconds...');
      setTimeout(connectToEventStream, 3000);
    }
  };
};

// Add event listener
const addEventListener = (event, callback) => {
  if (eventListeners[event]) {
    eventListeners[event].push(callback);
  }
};

// Remove event listener
const removeEventListener = (event, callback) => {
  if (eventListeners[event]) {
    const index = eventListeners[event].indexOf(callback);
    if (index !== -1) {
      eventListeners[event].splice(index, 1);
    }
  }
};

// Initialize the connection
connectToEventStream();

// API service
const api = {
  // Initialize a session
  initSession: async () => {
    try {
      const response = await axios.post(`${API_URL}/init`, {
        session_id: SESSION_ID
      });
      return response.data;
    } catch (error) {
      console.error('Error initializing session:', error);
      throw error;
    }
  },

  // Send a message to Aider
  sendMessage: async (message) => {
    try {
      const response = await axios.post(`${API_URL}/send_message`, {
        session_id: SESSION_ID,
        message
      });
      console.log('Message sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Get file lists
  getFiles: async () => {
    try {
      const response = await axios.get(`${API_URL}/get_files`, {
        params: { session_id: SESSION_ID }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting files:', error);
      throw error;
    }
  },

  // Add a file to the chat
  addFile: async (filename) => {
    try {
      const response = await axios.post(`${API_URL}/add_files`, {
        session_id: SESSION_ID,
        files: [filename]
      });
      return response.data;
    } catch (error) {
      console.error('Error adding file:', error);
      throw error;
    }
  },

  // Remove a file from the chat
  removeFile: async (filename) => {
    try {
      const response = await axios.post(`${API_URL}/remove_files`, {
        session_id: SESSION_ID,
        files: [filename]
      });
      return response.data;
    } catch (error) {
      console.error('Error removing file:', error);
      throw error;
    }
  },

  // Add a web page to the chat
  addWebPage: async (url) => {
    try {
      const response = await axios.post(`${API_URL}/add_web_page`, {
        session_id: SESSION_ID,
        url
      });
      return response.data;
    } catch (error) {
      console.error('Error adding web page:', error);
      throw error;
    }
  },

  // Undo a commit
  undoCommit: async (commitHash) => {
    try {
      const response = await axios.post(`${API_URL}/undo_commit`, {
        session_id: SESSION_ID,
        commit_hash: commitHash
      });
      return response.data;
    } catch (error) {
      console.error('Error undoing commit:', error);
      throw error;
    }
  },

  // Clear chat history
  clearHistory: async () => {
    try {
      const response = await axios.post(`${API_URL}/clear_history`, {
        session_id: SESSION_ID
      });
      return response.data;
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  },

  // Run a shell command
  runCommand: async (command) => {
    try {
      const response = await axios.post(`${API_URL}/run_command`, {
        session_id: SESSION_ID,
        command
      });
      return response.data;
    } catch (error) {
      console.error('Error running command:', error);
      throw error;
    }
  },
};

export { 
  SESSION_ID, 
  addEventListener, 
  removeEventListener,
};

export default api; 