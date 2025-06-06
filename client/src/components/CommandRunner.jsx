import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Paper } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import api from '../services/api';

const CommandRunner = () => {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRunCommand = async () => {
    if (!command.trim()) return;

    setIsLoading(true);
    setError('');
    setOutput('');

    try {
      const response = await api.runCommand(command);
      setOutput(response.output || '');
      if (!response.success) {
        setError(`Command failed with exit status ${response.exit_status}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to run command');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleRunCommand();
    }
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        border: '1px solid #f0f0f0',
        borderRadius: 1,
        backgroundColor: '#fff'
      }}
    >
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Command Runner
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter command to run..."
          disabled={isLoading}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fafafa',
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleRunCommand}
          disabled={isLoading || !command.trim()}
          startIcon={<PlayArrowIcon />}
          sx={{
            minWidth: '100px',
            backgroundColor: '#000',
            '&:hover': {
              backgroundColor: '#333',
            }
          }}
        >
          Run
        </Button>
      </Box>

      {error && (
        <Typography 
          color="error" 
          sx={{ 
            mb: 2, 
            p: 1, 
            backgroundColor: '#fff5f5',
            borderRadius: 1,
            border: '1px solid #ffebee'
          }}
        >
          {error}
        </Typography>
      )}

      {output && (
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            backgroundColor: '#fafafa',
            maxHeight: '300px',
            overflow: 'auto',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {output}
        </Paper>
      )}
    </Paper>
  );
};

export default CommandRunner; 