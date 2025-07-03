import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip
} from '@mui/material';
import { Folder as FolderIcon, GitHub as GitHubIcon } from '@mui/icons-material';

const ProjectSelector = ({ open, onClose, onSelectProject }) => {
  const [selectedPath, setSelectedPath] = useState('');
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSelectDirectory = async () => {
    if (!window.electronAPI?.selectProjectDirectory) {
      alert('Directory selection is only available in the desktop app');
      return;
    }

    try {
      setLoading(true);
      const result = await window.electronAPI.selectProjectDirectory();
      
      if (!result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        setSelectedPath(path);
        
        // Check if it's a git repository
        // This is a simple check - in a real implementation you might want to verify via the backend
        setIsGitRepo(true); // For now, assume it's a git repo
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
      alert('Failed to select directory');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onSelectProject(selectedPath);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedPath('');
    setIsGitRepo(false);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1e1e1e',
          color: '#e0e0e0',
          minHeight: '300px'
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #404040', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon />
          <Typography variant="h6">Select Project Directory</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 3 }}>
        <Typography sx={{ mb: 3, color: '#ccc' }}>
          Choose the directory containing your code project. NewRev works best with Git repositories.
        </Typography>

        {!selectedPath ? (
          <Box sx={{ 
            textAlign: 'center', 
            py: 4,
            border: '2px dashed #404040',
            borderRadius: 2,
            backgroundColor: '#252525'
          }}>
            <FolderIcon sx={{ fontSize: 48, color: '#666', mb: 2 }} />
            <Typography sx={{ color: '#888', mb: 2 }}>
              No directory selected
            </Typography>
            <Button
              variant="contained"
              onClick={handleSelectDirectory}
              disabled={loading}
              sx={{ 
                backgroundColor: '#007acc',
                '&:hover': { backgroundColor: '#005a9e' }
              }}
            >
              {loading ? 'Selecting...' : 'Choose Directory'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ 
            p: 3,
            border: '1px solid #404040',
            borderRadius: 2,
            backgroundColor: '#252525'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <FolderIcon sx={{ color: '#007acc' }} />
              <Typography sx={{ 
                fontFamily: 'Monaco, Consolas, monospace',
                fontSize: '14px',
                flex: 1,
                wordBreak: 'break-all'
              }}>
                {selectedPath}
              </Typography>
              {isGitRepo && (
                <Chip 
                  icon={<GitHubIcon />}
                  label="Git Repository"
                  size="small"
                  sx={{ 
                    backgroundColor: '#2d5016',
                    color: '#4caf50',
                    '& .MuiChip-icon': { color: '#4caf50' }
                  }}
                />
              )}
            </Box>
            
            <Button
              variant="outlined"
              onClick={handleSelectDirectory}
              disabled={loading}
              sx={{
                borderColor: '#404040',
                color: '#e0e0e0',
                '&:hover': {
                  borderColor: '#505050',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              Choose Different Directory
            </Button>
          </Box>
        )}

        {selectedPath && !isGitRepo && (
          <Alert severity="warning" sx={{ mt: 2, backgroundColor: '#3d2f00', color: '#ffb74d' }}>
            This directory doesn't appear to be a Git repository. Some features may not work properly.
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions sx={{ borderTop: '1px solid #404040', p: 3 }}>
        <Button 
          onClick={handleClose}
          sx={{
            color: '#e0e0e0',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)'
            }
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm}
          disabled={!selectedPath}
          variant="contained"
          sx={{ 
            backgroundColor: '#007acc',
            '&:hover': { backgroundColor: '#005a9e' },
            '&:disabled': { backgroundColor: '#333' }
          }}
        >
          Select Project
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectSelector;