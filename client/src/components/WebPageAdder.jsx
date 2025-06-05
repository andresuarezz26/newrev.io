import React, { useState } from 'react';
import { 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle, 
  TextField, 
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import api from '../services/api';

const WebPageAdder = ({ open, onClose }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!url.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);
      
      const response = await api.addWebPage(url);
      
      if (response.status === 'success') {
        setSuccess(true);
        // Clear the form after successful submission
        setUrl('');
        // Close dialog after a short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(response.message || 'Failed to add web page');
      }
    } catch (error) {
      setError('Error adding web page: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Web Page Content</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogContentText>
            Enter the URL of a web page to add its content to the chat.
            The content will be processed and made available to the LLM.
          </DialogContentText>
          
          {error && (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
              Web page content successfully added to the chat!
            </Alert>
          )}
          
          <TextField
            autoFocus
            margin="dense"
            label="URL"
            type="url"
            fullWidth
            variant="outlined"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            placeholder="https://example.com"
            required
            error={!!error}
            helperText="Include the full URL including https://"
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            disabled={isLoading || !url.trim()}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Adding...' : 'Add Web Page'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default WebPageAdder; 