import React, { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Box, Typography } from '@mui/material'
import api from '../services/api'

const CodeEditor = ({ selectedFile }) => {
  const [fileContent, setFileContent] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchFileContent = async () => {
      if (!selectedFile) return

      setIsLoading(true)
      try {
        const response = await api.getFileContent(selectedFile)
        if (response.status === 'success') {
          setFileContent(response.content)
          // Set language based on file extension
          const extension = selectedFile.split('.').pop().toLowerCase()
          const languageMap = {
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            py: 'python',
            html: 'html',
            css: 'css',
            json: 'json',
            md: 'markdown',
          }
          setLanguage(languageMap[extension] || 'plaintext')
        }
      } catch (error) {
        console.error('Error fetching file content:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFileContent()
  }, [selectedFile])

  const handleEditorChange = (value) => {
    setFileContent(value)
    // Here you can add logic to save changes to the file
  }

  if (!selectedFile) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          backgroundColor: '#1e1e1e',
        }}
      >
        <Typography
          sx={{
            color: '#888888',
            fontSize: '14px',
            fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          Select a file to view its contents
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        height: '100%',
        backgroundColor: '#1e1e1e',
        '& .monaco-editor': {
          paddingTop: '8px',
        },
      }}
    >
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        value={fileContent}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: '"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", monospace',
          lineHeight: 20,
          padding: { top: 8, bottom: 8 },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          readOnly: true,
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: "off",
          tabCompletion: "off",
          wordBasedSuggestions: false,
          semanticHighlighting: { enabled: false },
          diagnostics: { enabled: false },
          validation: { enabled: false },
          folding: false,
          lineNumbers: "on",
          glyphMargin: false,
          foldingHighlight: false,
          renderLineHighlight: "none",
          renderWhitespace: "none",
          renderControlCharacters: false,
          renderIndentGuides: false,
          renderValidationDecorations: "off"
        }}
        loading={
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              backgroundColor: '#1e1e1e',
            }}
          >
            <Typography
              sx={{
                color: '#888888',
                fontSize: '14px',
                fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              }}
            >
              Loading editor...
            </Typography>
          </Box>
        }
      />
    </Box>
  )
}

export default CodeEditor 