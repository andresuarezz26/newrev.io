import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Key as KeyIcon,
  Save as SaveIcon
} from '@mui/icons-material';

const API_KEY_CONFIGS = [
  {
    key: 'OPENAI_API_KEY',
    label: 'OpenAI',
    description: 'For GPT models (o1, o3-mini, GPT-4, etc.)',
    placeholder: 'sk-...',
    models: ['o3-mini', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  {
    key: 'ANTHROPIC_API_KEY',
    label: 'Anthropic',
    description: 'For Claude models (Claude 3.5 Sonnet, etc.)',
    placeholder: 'sk-ant-...',
    models: ['claude-3-5-sonnet', 'claude-3-haiku', 'claude-3-opus']
  },
  {
    key: 'DEEPSEEK_API_KEY',
    label: 'DeepSeek',
    description: 'For DeepSeek models',
    placeholder: 'sk-...',
    models: ['deepseek-coder', 'deepseek-chat']
  },
  {
    key: 'OPENROUTER_API_KEY',
    label: 'OpenRouter',
    description: 'Access to multiple models via OpenRouter',
    placeholder: 'sk-or-...',
    models: ['Multiple models available']
  },
  {
    key: 'OLLAMA_API_BASE',
    label: 'Ollama',
    description: 'Local Ollama server URL',
    placeholder: 'http://127.0.0.1:11434',
    models: ['Local models']
  }
];

const ApiKeyManager = ({ open, onClose, onSave }) => {
  const [apiKeys, setApiKeys] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load saved API keys from localStorage
    const savedKeys = {};
    API_KEY_CONFIGS.forEach(config => {
      const saved = localStorage.getItem(config.key);
      if (saved) {
        savedKeys[config.key] = saved;
      }
    });
    setApiKeys(savedKeys);
  }, [open]);

  const handleKeyChange = (keyName, value) => {
    setApiKeys(prev => ({
      ...prev,
      [keyName]: value
    }));
  };

  const toggleVisibility = (keyName) => {
    setShowKeys(prev => ({
      ...prev,
      [keyName]: !prev[keyName]
    }));
  };

  const handleSave = () => {
    setLoading(true);
    
    try {
      // Save to localStorage
      Object.entries(apiKeys).forEach(([key, value]) => {
        if (value && value.trim()) {
          localStorage.setItem(key, value.trim());
        } else {
          localStorage.removeItem(key);
        }
      });

      // Create environment object for backend
      const envData = {};
      Object.entries(apiKeys).forEach(([key, value]) => {
        if (value && value.trim()) {
          envData[key] = value.trim();
        }
      });

      // Notify parent component
      if (onSave) {
        onSave(envData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving API keys:', error);
      alert('Failed to save API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset to saved values
    const savedKeys = {};
    API_KEY_CONFIGS.forEach(config => {
      const saved = localStorage.getItem(config.key);
      if (saved) {
        savedKeys[config.key] = saved;
      }
    });
    setApiKeys(savedKeys);
    setShowKeys({});
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
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid #404040', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon />
          <Typography variant="h6">API Key Management</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2 }}>
        <Alert severity="info" sx={{ mb: 3, backgroundColor: '#1a2332', color: '#90caf9' }}>
          API keys are stored locally and securely. They're used to authenticate with AI model providers.
        </Alert>

        {API_KEY_CONFIGS.map((config) => (
          <Accordion 
            key={config.key}
            sx={{ 
              backgroundColor: '#252525',
              color: '#e0e0e0',
              mb: 1,
              '&:before': { display: 'none' },
              border: '1px solid #404040'
            }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon sx={{ color: '#e0e0e0' }} />}
              sx={{ borderBottom: '1px solid #404040' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Typography variant="h6">{config.label}</Typography>
                {apiKeys[config.key] && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      backgroundColor: '#2d5016',
                      color: '#4caf50',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1
                    }}
                  >
                    Configured
                  </Typography>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2 }}>
              <Typography sx={{ mb: 2, color: '#ccc' }}>
                {config.description}
              </Typography>
              
              <TextField
                fullWidth
                label={`${config.label} API Key`}
                type={showKeys[config.key] ? 'text' : 'password'}
                value={apiKeys[config.key] || ''}
                onChange={(e) => handleKeyChange(config.key, e.target.value)}
                placeholder={config.placeholder}
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => toggleVisibility(config.key)}
                        sx={{ color: '#e0e0e0' }}
                      >
                        {showKeys[config.key] ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#e0e0e0',
                    '& fieldset': {
                      borderColor: '#404040',
                    },
                    '&:hover fieldset': {
                      borderColor: '#505050',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#007acc',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#888888',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#007acc',
                  },
                }}
              />
              
              <Typography variant="caption" sx={{ mt: 1, color: '#888', display: 'block' }}>
                Supported models: {config.models.join(', ')}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
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
          onClick={handleSave}
          disabled={loading}
          variant="contained"
          startIcon={<SaveIcon />}
          sx={{ 
            backgroundColor: '#007acc',
            '&:hover': { backgroundColor: '#005a9e' }
          }}
        >
          {loading ? 'Saving...' : 'Save API Keys'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeyManager;