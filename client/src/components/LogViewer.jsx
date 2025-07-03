import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box,
  IconButton,
  Chip
} from '@mui/material';
import { Close as CloseIcon, Clear as ClearIcon } from '@mui/icons-material';

const LogViewer = ({ open, onClose }) => {
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for backend logs
    const handleBackendLog = (logEntry) => {
      setLogs(prev => [...prev, logEntry].slice(-1000)); // Keep last 1000 entries
    };

    // Add event listener
    window.electronAPI.onBackendLog?.(handleBackendLog);

    // Cleanup
    return () => {
      window.electronAPI.removeBackendLogListener?.(handleBackendLog);
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'ERROR': return '#f44336';
      case 'STDERR': return '#ff9800';
      case 'INFO': return '#2196f3';
      case 'STDOUT': return '#4caf50';
      default: return '#757575';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6">Backend Logs</Typography>
        <Box>
          <IconButton onClick={clearLogs} size="small" sx={{ mr: 1 }}>
            <ClearIcon />
          </IconButton>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ 
        flex: 1, 
        p: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ 
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#1e1e1e',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          fontSize: '12px',
          color: '#d4d4d4',
          p: 2
        }}>
          {logs.length === 0 ? (
            <Typography sx={{ color: '#888', textAlign: 'center', mt: 4 }}>
              No logs yet. Backend logs will appear here in real-time.
            </Typography>
          ) : (
            logs.map((log, index) => (
              <Box key={index} sx={{ mb: 0.5, display: 'flex', alignItems: 'flex-start' }}>
                <Typography 
                  component="span" 
                  sx={{ 
                    color: '#888', 
                    minWidth: '80px',
                    fontSize: '11px',
                    mr: 1
                  }}
                >
                  {formatTimestamp(log.timestamp)}
                </Typography>
                <Chip 
                  label={log.level} 
                  size="small"
                  sx={{ 
                    height: '16px',
                    fontSize: '10px',
                    minWidth: '60px',
                    backgroundColor: getLogLevelColor(log.level),
                    color: 'white',
                    mr: 1,
                    '& .MuiChip-label': {
                      px: 1
                    }
                  }}
                />
                <Typography 
                  component="span" 
                  sx={{ 
                    color: log.level === 'ERROR' ? '#f44336' : 
                           log.level === 'STDERR' ? '#ff9800' : '#d4d4d4',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    flex: 1
                  }}
                >
                  {log.message}
                </Typography>
              </Box>
            ))
          )}
          <div ref={logEndRef} />
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary' }}>
          {logs.length} log entries • Logs saved to ~/.newrev/logs/backend.log
        </Typography>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LogViewer;