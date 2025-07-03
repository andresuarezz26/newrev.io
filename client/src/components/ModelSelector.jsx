import React, { useState, useEffect } from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  Typography,
  Box,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Speed as SpeedIcon,
  MonetizationOn as MonetizationOnIcon,
  Computer as ComputerIcon
} from '@mui/icons-material';

const MODEL_CONFIGS = [
  // OpenAI Models
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Latest GPT-4 optimized model',
    tier: 'premium',
    speed: 'fast',
    requiresKey: 'OPENAI_API_KEY'
  },
  {
    value: 'o3-mini',
    label: 'o3-mini',
    provider: 'OpenAI',
    description: 'Latest reasoning model',
    tier: 'premium',
    speed: 'medium',
    requiresKey: 'OPENAI_API_KEY'
  },
  {
    value: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Fast and capable',
    tier: 'premium',
    speed: 'fast',
    requiresKey: 'OPENAI_API_KEY'
  },
  {
    value: 'gpt-3.5-turbo',
    label: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fast and cost-effective',
    tier: 'standard',
    speed: 'very-fast',
    requiresKey: 'OPENAI_API_KEY'
  },
  
  // Anthropic Models
  {
    value: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Best for coding tasks',
    tier: 'premium',
    speed: 'fast',
    requiresKey: 'ANTHROPIC_API_KEY'
  },
  {
    value: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    provider: 'Anthropic',
    description: 'Fast and efficient',
    tier: 'standard',
    speed: 'very-fast',
    requiresKey: 'ANTHROPIC_API_KEY'
  },
  
  // DeepSeek Models
  {
    value: 'deepseek-coder',
    label: 'DeepSeek Coder',
    provider: 'DeepSeek',
    description: 'Specialized for coding',
    tier: 'standard',
    speed: 'fast',
    requiresKey: 'DEEPSEEK_API_KEY'
  },
  {
    value: 'deepseek-chat',
    label: 'DeepSeek Chat',
    provider: 'DeepSeek',
    description: 'General purpose model',
    tier: 'standard',
    speed: 'fast',
    requiresKey: 'DEEPSEEK_API_KEY'
  },
  
  // OpenRouter Models
  {
    value: 'openrouter/google/gemini-2.0-flash-exp',
    label: 'Gemini 2.0 Flash',
    provider: 'Google (via OpenRouter)',
    description: 'Latest Gemini model',
    tier: 'premium',
    speed: 'fast',
    requiresKey: 'OPENROUTER_API_KEY'
  },
  {
    value: 'openrouter/anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet (OR)',
    provider: 'Anthropic (via OpenRouter)',
    description: 'Via OpenRouter',
    tier: 'premium',
    speed: 'fast',
    requiresKey: 'OPENROUTER_API_KEY'
  },
  
  // Local Models
  {
    value: 'ollama_chat/llama3',
    label: 'Llama 3 (Local)',
    provider: 'Ollama',
    description: 'Local inference',
    tier: 'free',
    speed: 'variable',
    requiresKey: 'OLLAMA_API_BASE'
  },
  {
    value: 'ollama_chat/codellama',
    label: 'Code Llama (Local)',
    provider: 'Ollama',
    description: 'Local coding model',
    tier: 'free',
    speed: 'variable',
    requiresKey: 'OLLAMA_API_BASE'
  }
];

const ModelSelector = ({ selectedModel, onModelChange, apiKeys = {} }) => {
  const [currentModel, setCurrentModel] = useState(selectedModel || 'claude-3-5-sonnet-20241022');

  useEffect(() => {
    if (selectedModel) {
      setCurrentModel(selectedModel);
    }
  }, [selectedModel]);

  const handleModelChange = (event) => {
    const newModel = event.target.value;
    setCurrentModel(newModel);
    if (onModelChange) {
      onModelChange(newModel);
    }
  };

  const getAvailableModels = () => {
    return MODEL_CONFIGS.filter(model => {
      // Check if required API key is available
      if (model.requiresKey && !apiKeys[model.requiresKey]) {
        return false;
      }
      return true;
    });
  };

  const getModelIcon = (tier) => {
    switch (tier) {
      case 'premium': return <PsychologyIcon sx={{ fontSize: 16 }} />;
      case 'standard': return <SpeedIcon sx={{ fontSize: 16 }} />;
      case 'free': return <ComputerIcon sx={{ fontSize: 16 }} />;
      default: return <PsychologyIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getSpeedColor = (speed) => {
    switch (speed) {
      case 'very-fast': return '#4caf50';
      case 'fast': return '#8bc34a';
      case 'medium': return '#ff9800';
      case 'slow': return '#f44336';
      case 'variable': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };

  const availableModels = getAvailableModels();
  const currentModelConfig = MODEL_CONFIGS.find(m => m.value === currentModel);

  return (
    <Box sx={{ minWidth: 200 }}>
      <FormControl fullWidth size="small">
        <Select
          value={currentModel}
          onChange={handleModelChange}
          sx={{
            color: '#e0e0e0',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#404040',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#505050',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#007acc',
            },
            '& .MuiSelect-icon': {
              color: '#e0e0e0',
            },
            fontSize: '13px',
            height: '32px'
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                backgroundColor: '#1e1e1e',
                color: '#e0e0e0',
                border: '1px solid #404040',
                maxHeight: 300
              }
            }
          }}
        >
          {availableModels.map((model) => (
            <MenuItem 
              key={model.value} 
              value={model.value}
              sx={{
                fontSize: '13px',
                py: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {getModelIcon(model.tier)}
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {model.label}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Chip
                    label={model.speed}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '10px',
                      backgroundColor: getSpeedColor(model.speed),
                      color: 'white',
                      '& .MuiChip-label': { px: 1 }
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#888', display: 'block' }}>
                  {model.provider} • {model.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
          
          {availableModels.length === 0 && (
            <MenuItem disabled sx={{ fontSize: '13px' }}>
              <Typography variant="body2" sx={{ color: '#888' }}>
                No models available. Configure API keys in Settings.
              </Typography>
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {/* Current model info */}
      {currentModelConfig && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#888' }}>
            {currentModelConfig.provider}
          </Typography>
          <Chip
            label={currentModelConfig.tier}
            size="small"
            sx={{
              height: 16,
              fontSize: '10px',
              backgroundColor: currentModelConfig.tier === 'premium' ? '#7b1fa2' : 
                              currentModelConfig.tier === 'standard' ? '#1976d2' : '#388e3c',
              color: 'white',
              '& .MuiChip-label': { px: 1 }
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ModelSelector;