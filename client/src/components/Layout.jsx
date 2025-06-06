"use client"

import { useState } from "react"
import { Box, Typography, Drawer, IconButton, AppBar, Toolbar, Divider, Button } from "@mui/material"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import AutorenewIcon from "@mui/icons-material/Autorenew"
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import WebIcon from "@mui/icons-material/Web"
import CloseIcon from "@mui/icons-material/Close"

import ChatInterface from "./ChatInterface"
import FileManager from "./FileManager"
import WebPageAdder from "./WebPageAdder"
import api from "../services/api"

const drawerWidth = 400
const iframeWidth = 800
const previewUrl = "http://localhost:5173/"

const Layout = () => {
  const [showWebAdder, setShowWebAdder] = useState(false)
  const [showPreview, setShowPreview] = useState(true)

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

  const togglePreview = () => {
    setShowPreview(!showPreview)
  }

  const drawer = (
    <Box sx={{ p: 2 }}>
      <FileManager />
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
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
            onClick={() => window.open(previewUrl, "_blank")}
            sx={{
              mr: 1,
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
          <IconButton 
            onClick={togglePreview} 
            sx={{ 
              ml: 1,
              color: "#e0e0e0",
              backgroundColor: showPreview ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              width: 32,
              height: 32,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.15)'
              }
            }}
          >
            {showPreview ? <CloseIcon sx={{ fontSize: 18 }} /> : <AspectRatioIcon sx={{ fontSize: 18 }} />}
          </IconButton>
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
            width: showPreview ? `calc(100% - ${drawerWidth}px - ${iframeWidth}px)` : `calc(100% - ${drawerWidth}px)`,
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1e1e1e",
          }}
        >
          <Box sx={{ flex: 1, overflow: "hidden", padding: "15px" }}>
            <ChatInterface />
          </Box>
        </Box>

        {/* Right-side iframe preview */}
        {showPreview && (
          <Box
            sx={{
              width: `${iframeWidth}px`,
              borderLeft: "1px solid #404040",
              height: "100%",
              position: "relative",
              zIndex: 1,
              backgroundColor: "#1e1e1e",
            }}
          >
            <iframe
              src={previewUrl}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Live Preview"
            />
          </Box>
        )}
      </Box>

      {showWebAdder && <WebPageAdder open={showWebAdder} onClose={() => setShowWebAdder(false)} />}
    </Box>
  )
}

export default Layout