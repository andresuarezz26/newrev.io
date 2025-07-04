import React, { useState, useEffect } from 'react';
import {
  FormControl,
  Select,
  MenuItem,
  Typography,
  Box
} from '@mui/material';

const MODEL_CONFIGS = [
  // OpenAI Models
  {
    value: 'gpt-4.1',
    label: 'GPT-41',
    provider: 'OpenAI',
    description: 'Well-rounded, good at most things. Be in control.',
    tier: 'premium',
    speed: 'fast',
    requiresKey: 'OPENAI_API_KEY'
  },
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    description: '',
    tier: 'premium',
    speed: 'fast',
    requiresKey: 'OPENAI_API_KEY'
  },
  {
    value: 'o3',
    label: 'o3',
    provider: 'OpenAI',
    description: 'Complex problems, difficult bugs, deep reasoning. Slow.',
    tier: 'premium',
    speed: 'slow',
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
  {
    value: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    provider: 'DeepSeek',
    description: '',
    tier: 'standard',
    speed: 'slow',
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
  {
    value: 'openrouter/deepseek/deepseek-r1-0528-qwen3-8b:free',
    label: 'Deepseek R1 0528 Qwen3 8B (free)',
    provider: 'DeepSeek',
    description: 'Via OpenRouter',
    tier: 'free',
    speed: 'slow',
    requiresKey: 'OPENROUTER_API_KEY'
  },
  {
    value: 'openrouter/deepseek/deepseek-chat:free',
    label: 'Deepseek Chat (free)',
    provider: 'DeepSeek',
    description: 'Via OpenRouter',
    tier: 'free',
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

  const availableModels = getAvailableModels();

  return (
    <Box sx={{ minWidth: 180 }}>
      <FormControl fullWidth size="small">
        <Select
          value={currentModel}
          onChange={handleModelChange}
          sx={{
            color: '#e0e0e0',
            backgroundColor: '#2a2a2a',
            borderRadius: '6px',
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
            fontSize: '11px',
            height: '28px',
            fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: 500
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                backgroundColor: '#2a2a2a',
                color: '#e0e0e0',
                border: '1px solid #404040',
                borderRadius: '8px',
                maxHeight: 300,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
              }
            }
          }}
        >
          {availableModels.map((model) => (
            <MenuItem 
              key={model.value} 
              value={model.value}
              sx={{
                fontSize: '11px',
                py: 0.5,
                px: 1.5,
                minHeight: '32px',
                fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
                '&:hover': {
                  backgroundColor: '#333333'
                },
                '&.Mui-selected': {
                  backgroundColor: '#0066cc',
                  '&:hover': {
                    backgroundColor: '#0066cc'
                  }
                }
              }}
            >
              <Typography variant="body2" sx={{ 
                fontWeight: 500,
                fontSize: '11px',
                fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif'
              }}>
                {model.label}
              </Typography>
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

    </Box>
  );
};

export default ModelSelector;