"use client"

import { useState, useEffect, useRef } from "react"
import { Button, TextField, Paper, Typography, Box, Divider, CircularProgress, IconButton } from "@mui/material"
import SendIcon from "@mui/icons-material/Send"
import api, { addEventListener, removeEventListener, SESSION_ID } from "../services/api"
import DiffViewer from './DiffViewer'

const ChatInterface = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [streamingContent, setStreamingContent] = useState("")
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const isUserScrollingRef = useRef(false)

  // Effect to initialize the session
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await api.initSession()
        if (response.status === "success") {
          setMessages(response.messages || [])
        }
        setIsInitializing(false)
      } catch (error) {
        console.error("Failed to initialize session:", error)
        setIsInitializing(false)
      }
    }

    initSession()
  }, [])

  // Handle scroll events
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollHeight = container.scrollHeight
      const scrollTop = container.scrollTop
      const clientHeight = container.clientHeight
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50
  
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  // Effect to scroll to bottom when new content arrives
  useEffect(() => {

    if (!isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    } 
  }, [messages, streamingContent])

  // Effect to set up event listeners
  useEffect(() => {
    const handleMessageChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        console.log('Received message chunk')
        setStreamingContent((prev) => prev + (data.chunk || ""))
      }
    }

    const handleMessageComplete = (data) => {
      if (data.session_id === SESSION_ID) {
        if (streamingContent) {
          setMessages((prev) => [...prev, { role: "assistant", content: streamingContent }])
        }
        setStreamingContent("")
        setIsLoading(false)
      }
    }

    const handleFilesEdited = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [
          ...prev,
          {
            role: "info",
            content: `Files edited: ${data.files.join(", ")}`,
          },
        ])
      }
    }

    const handleCommit = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [
          ...prev,
          {
            role: "commit",
            content: `Commit: ${data.hash}\nMessage: ${data.message}`,
            hash: data.hash,
            message: data.message,
            diff: data.diff,
          },
        ])
      }
    }

    const handleError = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [...prev, { role: "error", content: data.message }])
        setIsLoading(false)
      }
    }

    addEventListener("message_chunk", handleMessageChunk)
    addEventListener("message_complete", handleMessageComplete)
    addEventListener("files_edited", handleFilesEdited)
    addEventListener("commit", handleCommit)
    addEventListener("error", handleError)

    return () => {
      removeEventListener("message_chunk", handleMessageChunk)
      removeEventListener("message_complete", handleMessageComplete)
      removeEventListener("files_edited", handleFilesEdited)
      removeEventListener("commit", handleCommit)
      removeEventListener("error", handleError)
    }
  }, [streamingContent])

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput("")
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    
    isUserScrollingRef.current = false

    try {
      await api.sendMessage(userMessage)
    } catch (error) {
      console.error("Error sending message:", error)
      setIsLoading(false)
      setMessages((prev) => [...prev, { role: "error", content: "Failed to send message. Please try again." }])
    }
  }

  const messageStyles = {
    user: {
      backgroundColor: '#2d2d2d',
      color: '#ffffff',
      borderRadius: '8px',
      marginLeft: 'auto',
      maxWidth: '80%',
      border: '1px solid #404040',
    },
    assistant: {
      backgroundColor: '#262626',
      color: '#e0e0e0',
      borderRadius: '8px',
      marginRight: 'auto',
      maxWidth: '80%',
      border: '1px solid #404040',
    },
    info: {
      backgroundColor: '#1a365d',
      color: '#90cdf4',
      borderRadius: '8px',
      margin: '8px auto',
      maxWidth: '90%',
      border: '1px solid #2d5a87',
    },
    error: {
      backgroundColor: '#742a2a',
      color: '#feb2b2',
      borderRadius: '8px',
      margin: '8px auto',
      maxWidth: '90%',
      border: '1px solid #9b2c2c',
    },
    commit: {
      backgroundColor: '#1a202c',
      color: '#68d391',
      borderRadius: '8px',
      margin: '8px auto',
      maxWidth: '90%',
      border: '1px solid #2d3748',
    },
  }

  const renderMessage = (message, index) => {
    const { role, content } = message

    const hasDiff = role === "commit" && message.diff;

    return (
      <Box
        key={index}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: role === 'user' ? 'flex-end' : 'flex-start',
          mb: 2,
          width: '100%',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            ...messageStyles[role],
            boxShadow: 'none',
            width: role === 'commit' ? '100%' : undefined,
          }}
        >
          <Typography
            variant="body1"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '14px',
              lineHeight: 1.6,
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            {!hasDiff && content}
            {role === "commit" && (
              <>
                <Typography component="span" sx={{ color: '#85e89d', fontWeight: 500 }}>Commit: </Typography>
                <Typography component="span" sx={{ color: '#e0e0e0' }}>{message.hash}</Typography>
                <br />
                <Typography component="span" sx={{ color: '#85e89d', fontWeight: 500 }}>Message: </Typography>
                <Typography component="span" sx={{ color: '#e0e0e0' }}>{message.message}</Typography>
              </>
            )}
          </Typography>

          {hasDiff && (
            <Box mt={1}>
              <DiffViewer diff={message.diff} maxHeight="400px" />
              <Button
                size="small"
                variant="outlined"
                onClick={() => api.undoCommit(message.hash)}
                sx={{
                  mt: 2,
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  borderColor: '#404040',
                  color: '#e0e0e0',
                  '&:hover': {
                    borderColor: '#606060',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                Revert Changes
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    )
  }

  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxWidth: "100%",
        mx: "auto",
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: "none",
        border: "none",
        borderRadius: "0",
        overflow: "hidden",
        backgroundColor: "#1e1e1e",
      }}
    >
      {isInitializing ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
          <CircularProgress sx={{ color: "#007acc" }} />
        </Box>
      ) : (
        <>
          <Box
            ref={messagesContainerRef}
            sx={{
              flex: 1,
              p: 3,
              overflowY: "auto",
              position: "relative",
              backgroundColor: "#1e1e1e",
              scrollBehavior: "smooth",
            }}
          >
            {messages.map(renderMessage)}

            {streamingContent && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  mb: 2,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    backgroundColor: '#262626',
                    color: '#e0e0e0',
                    borderRadius: '8px',
                    marginRight: 'auto',
                    maxWidth: '80%',
                    border: '1px solid #404040',
                    boxShadow: 'none',
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '14px',
                      lineHeight: 1.6,
                      fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                  >
                    {streamingContent}
                  </Typography>
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          <Box
            component="form"
            onSubmit={handleSendMessage}
            sx={{
              p: 2,
              display: "flex",
              alignItems: "flex-end",
              borderTop: "1px solid #404040",
              backgroundColor: "#1e1e1e",
              gap: 1,
            }}
          >
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={6}
              variant="outlined"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  backgroundColor: "#2d2d2d",
                  color: "#ffffff",
                  paddingRight: "12px",
                  transition: "all 0.2s ease",
                  "& fieldset": {
                    borderColor: "#404040",
                  },
                  "&:hover fieldset": {
                    borderColor: "#505050",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#606060",
                  },
                },
                "& .MuiInputBase-input": {
                  padding: "12px 16px",
                  fontSize: "14px",
                  color: "#ffffff",
                  "&::placeholder": {
                    color: "#888888",
                    opacity: 1,
                  },
                },
              }}
            />
            <IconButton
              type="submit"
              disabled={isLoading || !input.trim()}
              sx={{
                backgroundColor: "#007acc",
                color: "#fff",
                width: 40,
                height: 40,
                alignSelf: "flex-end",
                borderRadius: "6px",
                "&:hover": {
                  backgroundColor: "#0066aa",
                },
                "&.Mui-disabled": {
                  backgroundColor: "#404040",
                  color: "#666666",
                },
              }}
            >
              {isLoading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Box>
        </>
      )}
    </Paper>
  )
}

export default ChatInterface