import { useState, useRef, useEffect } from "react"
import { Box, Typography, Drawer, AppBar, Toolbar, Button, ToggleButton, ToggleButtonGroup } from "@mui/material"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import CodeIcon from '@mui/icons-material/Code'
import PreviewIcon from '@mui/icons-material/Preview'
import SettingsIcon from "@mui/icons-material/Settings"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import TextField from "@mui/material/TextField"

import ChatInterface from "./ChatInterface"
import FileManager from "./FileManager"
import WebPageAdder from "./WebPageAdder"
import CodeEditor from "./CodeEditor"
import LogViewer from "./LogViewer"
import api from "../services/api"

const drawerWidth = 350
const minChatWidth = 300
const maxChatWidth = 800
const defaultChatWidth = 500

const Layout = () => {
  const [showWebAdder, setShowWebAdder] = useState(false)
  const [mode, setMode] = useState('preview') // 'preview' or 'code'
  const [selectedFile, setSelectedFile] = useState(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState("")
  const [chatWidth, setChatWidth] = useState(defaultChatWidth)
  const [isDragging, setIsDragging] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to clear the chat history? This cannot be undone.")) {
      try {
        await api.clearHistory()
        window.location.reload()
      } catch (error) {
        console.error("Error clearing history:", error)
        alert("Failed to clear chat history. Please try again.")
      }
    }
  }

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setMode(newMode)
    }
  }

  const handleFileSelect = (file) => {
    setSelectedFile(file)
  }

  const handleConfigOpen = () => setConfigOpen(true)
  const handleConfigClose = () => setConfigOpen(false)
  const handlePreviewUrlChange = (e) => setPreviewUrl(e.target.value)

  const handleDragStart = (e) => {
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = chatWidth
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  const handleDrag = (e) => {
    if (!isDragging) return
    
    const deltaX = dragStartX.current - e.clientX
    const newWidth = Math.min(Math.max(dragStartWidth.current + deltaX, minChatWidth), maxChatWidth)
    setChatWidth(newWidth)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag)
      window.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging])

  // Listen for log toggle from Electron menu
  useEffect(() => {
    if (window.electronAPI?.onToggleLogs) {
      const handleToggleLogs = () => {
        setShowLogs(prev => !prev)
      }
      
      window.electronAPI.onToggleLogs(handleToggleLogs)
      
      return () => {
        // Cleanup if needed
      }
    }
  }, [])

  const drawer = (
    <Box sx={{ p: 2 }}>
      <FileManager onFileSelect={handleFileSelect} />
    </Box>
  )

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: "#1e1e1e",
      }}
    >
      <AppBar
        position="static"
        sx={{
          backgroundColor: "#1e1e1e",
          color: "#e0e0e0",
          boxShadow: "none",
          borderBottom: "1px solid #404040",
        }}
      >
        <Toolbar>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              fontWeight: 600, 
              fontSize: "18px",
              color: "#e0e0e0",
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            Newrev.io
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            aria-label="view mode"
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: '#e0e0e0',
                borderColor: '#404040',
                '&.Mui-selected': {
                  backgroundColor: '#007acc',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: '#0066aa',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              },
            }}
          >
            <ToggleButton value="preview" aria-label="preview mode">
              <PreviewIcon sx={{ fontSize: 18, mr: 1 }} />
              Preview
            </ToggleButton>
            <ToggleButton value="code" aria-label="code mode">
              <CodeIcon sx={{ fontSize: 18, mr: 1 }} />
              Code
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
            onClick={() => window.open(previewUrl, "_blank")}
            sx={{
              ml: 2,
              textTransform: "none",
              borderColor: "#404040",
              color: "#e0e0e0",
              height: "32px",
              fontSize: "13px",
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              "&:hover": {
                borderColor: "#505050",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              },
            }}
          >
            Open Preview
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
            onClick={handleConfigOpen}
            sx={{
              ml: 1,
              textTransform: "none",
              borderColor: "#404040",
              color: "#e0e0e0",
              height: "32px",
              fontSize: "13px",
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              "&:hover": {
                borderColor: "#505050",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              },
            }}
          >
            Settings
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 2, overflow: "hidden" }}>
        <Drawer
          variant="permanent"
          sx={{
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              borderRight: "1px solid #404040",
              height: "100%",
              position: "relative",
              backgroundColor: "#1e1e1e",
            },
          }}
          open
        >
          {drawer}
        </Drawer>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: `calc(100% - ${drawerWidth}px - ${chatWidth}px)`,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1e1e1e",
          }}
        >
          {mode === 'preview' ? (
            <iframe
              src={previewUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Live Preview"
            />
          ) : (
            <CodeEditor selectedFile={selectedFile} />
          )}
        </Box>

        {/* Draggable divider */}
        <Box
          onMouseDown={handleDragStart}
          sx={{
            width: '4px',
            cursor: 'ew-resize',
            backgroundColor: isDragging ? '#007acc' : 'transparent',
            '&:hover': {
              backgroundColor: '#404040',
            },
            position: 'relative',
            zIndex: 2,
          }}
        />

        {/* Right-side chat */}
        <Box
          sx={{
            width: `${chatWidth}px`,
            borderLeft: "1px solid #404040",
            height: "100%",
            position: "relative",
            zIndex: 1,
            backgroundColor: "#1e1e1e",
          }}
        >
          <ChatInterface />
        </Box>
      </Box>

      {showWebAdder && <WebPageAdder open={showWebAdder} onClose={() => setShowWebAdder(false)} />}

      {/* Config Dialog */}
      <Dialog 
        open={configOpen} 
        onClose={handleConfigClose}
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            color: '#e0e0e0',
            minWidth: '400px',
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #404040' }}>Settings</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TextField
            label="Preview URL"
            value={previewUrl}
            onChange={handlePreviewUrlChange}
            fullWidth
            margin="normal"
            variant="outlined"
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
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #404040', p: 2 }}>
          <Button 
            onClick={handleConfigClose} 
            sx={{
              color: '#e0e0e0',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Log Viewer */}
      <LogViewer 
        open={showLogs} 
        onClose={() => setShowLogs(false)} 
      />
    </Box>
  )
}

export default Layout