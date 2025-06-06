"use client"

import { useState, useEffect, useRef } from "react"
import { Button, TextField, Paper, Typography, Box, Divider, CircularProgress, IconButton } from "@mui/material"
import SendIcon from "@mui/icons-material/Send"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import api, { addEventListener, removeEventListener, SESSION_ID } from "../services/api"

const ChatInterface = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [streamingContent, setStreamingContent] = useState("")
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const isUserScrollingRef = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const lastScrollPositionRef = useRef(0)
  const lastScrollHeightRef = useRef(0)

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

  // Handle scroll events in the messages container
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      lastScrollPositionRef.current = container.scrollTop
      lastScrollHeightRef.current = container.scrollHeight
      const isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 50
      isUserScrollingRef.current = !isAtBottom
      setShowScrollButton(!isAtBottom && streamingContent)
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [streamingContent])

  // Effect to preserve scroll position when new content is added
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !isUserScrollingRef.current) return

    if (streamingContent && isUserScrollingRef.current) {
      const heightDifference = container.scrollHeight - lastScrollHeightRef.current
      if (heightDifference > 0) {
        container.scrollTop = lastScrollPositionRef.current
      }
      lastScrollHeightRef.current = container.scrollHeight
    }
  }, [streamingContent])

  // Effect to set up event listeners
  useEffect(() => {
    const handleMessageChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        setStreamingContent((prev) => {
          if (messagesContainerRef.current && isUserScrollingRef.current) {
            lastScrollPositionRef.current = messagesContainerRef.current.scrollTop
            lastScrollHeightRef.current = messagesContainerRef.current.scrollHeight
          }
          return prev + (data.chunk || "")
        })
      }
    }

    const handleMessageComplete = (data) => {
      if (data.session_id === SESSION_ID) {
        if (streamingContent) {
          if (messagesContainerRef.current && isUserScrollingRef.current) {
            lastScrollPositionRef.current = messagesContainerRef.current.scrollTop
            lastScrollHeightRef.current = messagesContainerRef.current.scrollHeight
          }
          setMessages((prev) => [...prev, { role: "assistant", content: streamingContent }])
        }
        setStreamingContent("")
        setIsLoading(false)
        setShowScrollButton(false)
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

  // Effect to scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput("")
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    isUserScrollingRef.current = false
    setShowScrollButton(false)

    try {
      await api.sendMessage(userMessage)
    } catch (error) {
      console.error("Error sending message:", error)
      setIsLoading(false)
      setMessages((prev) => [...prev, { role: "error", content: "Failed to send message. Please try again." }])
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    isUserScrollingRef.current = false
    setShowScrollButton(false)
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

    return (
      <Box
        key={index}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: role === 'user' ? 'flex-end' : 'flex-start',
          mb: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            ...messageStyles[role],
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
            {content}
          </Typography>

          {role === "commit" && message.diff && (
            <Box mt={1}>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={() => api.undoCommit(message.hash)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  borderColor: 'rgba(0,0,0,0.1)',
                  '&:hover': {
                    borderColor: 'rgba(0,0,0,0.2)',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                  },
                }}
              >
                Revert Changes
              </Button>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  mt: 1,
                  p: 1,
                  backgroundColor: 'rgba(0,0,0,0.02)',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              >
                {message.diff}
              </Typography>
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

            {showScrollButton && (
              <Button
                variant="contained"
                onClick={scrollToBottom}
                sx={{
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                  zIndex: 10,
                  minWidth: "auto",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  padding: 0,
                  backgroundColor: "#404040",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  "&:hover": {
                    backgroundColor: "#505050",
                  },
                }}
              >
                <KeyboardArrowDownIcon />
              </Button>
            )}
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