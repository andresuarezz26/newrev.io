"use client"

import { useState } from "react"
import { Box, Typography, Drawer, AppBar, Toolbar, Button, ToggleButton, ToggleButtonGroup } from "@mui/material"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import CodeIcon from '@mui/icons-material/Code'
import PreviewIcon from '@mui/icons-material/Preview'

import ChatInterface from "./ChatInterface"
import FileManager from "./FileManager"
import WebPageAdder from "./WebPageAdder"
import CodeEditor from "./CodeEditor"
import api from "../services/api"

const drawerWidth = 350
const chatWidth = 500
const previewUrl = "http://localhost:5173/"

const Layout = () => {
  const [showWebAdder, setShowWebAdder] = useState(false)
  const [mode, setMode] = useState('preview') // 'preview' or 'code'
  const [selectedFile, setSelectedFile] = useState(null)

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
    </Box>
  )
}

export default Layout