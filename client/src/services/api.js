import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Check if running in Electron
const isElectron = window.electronAPI !== undefined;

// Get API URL - use dynamic port in Electron, fallback for web
const getApiUrl = async () => {
  if (isElectron) {
    try {
      const port = await window.electronAPI.getApiPort();
      return `http://localhost:${port}/api`;
    } catch (error) {
      console.error('Failed to get API port from Electron:', error);
      return 'http://localhost:5000/api';
    }
  }
  return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
};

// Initialize API_URL
let API_URL = 'http://localhost:5000/api';
getApiUrl().then(url => {
  API_URL = url;
  console.log('API URL set to:', API_URL);
});

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
const connectToEventStream = async () => {
  if (eventSource) {
    eventSource.close();
  }

  // Ensure we have the correct API URL
  const apiUrl = await getApiUrl();
  
  // Create new EventSource connection
  eventSource = new EventSource(`${apiUrl}/stream?session_id=${SESSION_ID}`);
  
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
connectToEventStream().catch(console.error);

// API service
const api = {
  // Initialize a session
  initSession: async () => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/init`, {
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
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/send_message`, {
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
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/get_files`, {
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
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/add_files`, {
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
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/remove_files`, {
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
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/add_web_page`, {
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
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/undo_commit`, {
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
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/clear_history`, {
        session_id: SESSION_ID
      });
      return response.data;
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  },

  // Run a command
  runCommand: async (command) => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/run_command`, {
        session_id: SESSION_ID,
        command
      });
      return response.data;
    } catch (error) {
      console.error('Error running command:', error);
      throw error;
    }
  },

  getFileContent: async (filePath) => {
    try {
      console.log('Fetching file content for:', filePath)
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/repo_file`, {
        params: {
          file_name: filePath
        }
      })
      return {
        status: response.data.status,
        content: response.data.file_content
      }
    } catch (error) {
      console.error('Error fetching file content:', error)
      throw error
    }
  },

  // Set the mode for the current session
  setMode: async ({ mode, architectModel, reasoningEffort, thinkingTokens }) => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/set_mode`, {
        session_id: SESSION_ID,
        mode,
        architect_model: architectModel || null,
        reasoning_effort: reasoningEffort || null,
        thinking_tokens: thinkingTokens || null
      });
      return response.data;
    } catch (error) {
      console.error('Error setting mode:', error);
      throw error;
    }
  },

  // Initialize project with directory and API keys
  initializeProject: async ({ projectPath, apiKeys, model }) => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/initialize_project`, {
        session_id: SESSION_ID,
        project_path: projectPath,
        api_keys: apiKeys,
        model: model
      });
      return response.data;
    } catch (error) {
      console.error('Error initializing project:', error);
      throw error;
    }
  },

  // Update API keys
  updateApiKeys: async (apiKeys) => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/update_api_keys`, {
        session_id: SESSION_ID,
        api_keys: apiKeys
      });
      return response.data;
    } catch (error) {
      console.error('Error updating API keys:', error);
      throw error;
    }
  },

  // Update model
  updateModel: async (model) => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/update_model`, {
        session_id: SESSION_ID,
        model: model
      });
      return response.data;
    } catch (error) {
      console.error('Error updating model:', error);
      throw error;
    }
  },

  // Health check
  healthCheck: async () => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/health`);
      return response.data;
    } catch (error) {
      console.error('Error checking API health:', error);
      throw error;
    }
  },

  // Refresh files
  refreshFiles: async () => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.post(`${apiUrl}/refresh_files`, {
        session_id: SESSION_ID
      });
      return response.data;
    } catch (error) {
      console.error('Error refreshing files:', error);
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