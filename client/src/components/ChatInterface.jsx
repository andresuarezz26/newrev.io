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
      // Store the current scroll position and height
      lastScrollPositionRef.current = container.scrollTop
      lastScrollHeightRef.current = container.scrollHeight

      // Check if user is at the bottom of the container
      const isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 50

      // Update the scrolling state
      isUserScrollingRef.current = !isAtBottom
      setShowScrollButton(!isAtBottom && streamingContent)
    }

    // Add scroll event listener
    container.addEventListener("scroll", handleScroll)

    // Clean up
    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [streamingContent])

  // Effect to preserve scroll position when new content is added
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !isUserScrollingRef.current) return

    // If we're in the middle of receiving streaming content and the user has scrolled
    if (streamingContent && isUserScrollingRef.current) {
      // Calculate how much the content height has changed
      const heightDifference = container.scrollHeight - lastScrollHeightRef.current

      // Adjust scroll position to keep the user's view in the same relative position
      if (heightDifference > 0) {
        container.scrollTop = lastScrollPositionRef.current
      }

      // Update the reference height for next comparison
      lastScrollHeightRef.current = container.scrollHeight
    }
  }, [streamingContent])

  // Effect to set up event listeners
  useEffect(() => {
    // Message chunk handler
    const handleMessageChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        setStreamingContent((prev) => {
          // Before updating the content, store the current scroll position
          // if the user is scrolling
          if (messagesContainerRef.current && isUserScrollingRef.current) {
            lastScrollPositionRef.current = messagesContainerRef.current.scrollTop
            lastScrollHeightRef.current = messagesContainerRef.current.scrollHeight
          }
          return prev + (data.chunk || "")
        })
      }
    }

    // Message complete handler
    const handleMessageComplete = (data) => {
      if (data.session_id === SESSION_ID) {
        if (streamingContent) {
          // Store the current scroll position before adding the final message
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

    // Files edited handler
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

    // Commit handler
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

    // Error handler
    const handleError = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [...prev, { role: "error", content: data.message }])
        setIsLoading(false)
      }
    }

    // Set up event listeners
    addEventListener("message_chunk", handleMessageChunk)
    addEventListener("message_complete", handleMessageComplete)
    addEventListener("files_edited", handleFilesEdited)
    addEventListener("commit", handleCommit)
    addEventListener("error", handleError)

    // Clean up event listeners
    return () => {
      removeEventListener("message_chunk", handleMessageChunk)
      removeEventListener("message_complete", handleMessageComplete)
      removeEventListener("files_edited", handleFilesEdited)
      removeEventListener("commit", handleCommit)
      removeEventListener("error", handleError)
    }
  }, [streamingContent])

  // Effect to scroll to bottom when new messages arrive or when explicitly requested
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Handle send message
  const handleSendMessage = async (e) => {
    e?.preventDefault()

    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput("")
    setIsLoading(true)

    // Add user message immediately
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])

    // Reset scroll position when sending a new message
    isUserScrollingRef.current = false
    setShowScrollButton(false)

    try {
      await api.sendMessage(userMessage)
      // The response will come via event listeners
    } catch (error) {
      console.error("Error sending message:", error)
      setIsLoading(false)

      // Add error message
      setMessages((prev) => [...prev, { role: "error", content: "Failed to send message. Please try again." }])
    }
  }

  // Force scroll to bottom button
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    isUserScrollingRef.current = false
    setShowScrollButton(false)
  }

  // Render message based on role
    const renderMessage = (message, index) => {
        const { role, content } = message;

        let messageStyle = {};

        switch (role) {
            case "user":
                messageStyle = {
                    backgroundColor: '#000000',
                    color: '#ffffff',
                };
                break;
            case "assistant":
                messageStyle = {
                    backgroundColor: '#f5f5f5',
                    color: '#000000',
                };
                break;
            case "info":
                messageStyle = {
                    backgroundColor: '#f5f5f5',
                    color: '#000000',
                };
                break;
            case "error":
                messageStyle = {
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                };
                break;
            case "commit":
                messageStyle = {
                    backgroundColor: '#f5f5f5',
                    color: '#000000',
                };
                break;
            default:
                messageStyle = {
                    backgroundColor: '#f5f5f5',
                    color: '#000000',
                };
        }

        return (
            <Paper
                key={index}
                elevation={1}
                style={{
                    padding: '10px 15px',
                    marginBottom: '10px',
                    ...messageStyle,
                }}
            >
                <Typography variant="caption" display="block" gutterBottom>
                    {role.toUpperCase()}
                </Typography>
                <Typography variant="body1" style={{ whiteSpace: 'pre-wrap' }}>
                    {content}
                </Typography>

                {role === "commit" && message.diff && (
                    <Box mt={1}>
                        <Button size="small" variant="outlined" color="primary" onClick={() => api.undoCommit(message.hash)}>
                            Revert Changes
                        </Button>
                        <Typography
                            variant="body2"
                            component="pre"
                            style={{
                                marginTop: '10px',
                                padding: '10px',
                                backgroundColor: '#f5f5f5',
                                overflowX: 'auto',
                                fontSize: '0.8rem',
                            }}
                        >
                            {message.diff}
                        </Typography>
                    </Box>
                )}
            </Paper>
        );
    };

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
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        border: "1px solid #eaeaea",
        borderRadius: "16px",
        overflow: "hidden",
      }}
    >

      {isInitializing ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
          <CircularProgress sx={{ color: "#000" }} />
        </Box>
      ) : (
        <>
          <Box sx={{ p: 2.5, borderBottom: "1px solid #f0f0f0" }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                fontSize: "18px",
                color: "#111",
              }}
            >
              Chat
            </Typography>
          </Box>
          
          <Box
            ref={messagesContainerRef}
            sx={{
              flex: 1,
              p: 2,
              overflowY: "auto",
              position: "relative",
              backgroundColor: "#fafafa",
            }}
          >
            {messages.map(renderMessage)}

            {streamingContent && (
              <Paper
                elevation={1}
                style={{
                  padding: "10px 15px",
                  marginBottom: "10px",
                  backgroundColor: "#f1f8e9",
                }}
              >
                <Typography variant="caption" display="block" gutterBottom>
                  ASSISTANT
                </Typography>
                <Typography variant="body1" style={{ whiteSpace: "pre-wrap" }}>
                  {streamingContent}
                </Typography>
              </Paper>
            )}

            <div ref={messagesEndRef} />

            {/* Scroll to bottom button, only shown when user has scrolled up */}
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
                  width: 40,
                  height: 40,
                  padding: 0,
                  backgroundColor: "#1976d2",
                  boxShadow: "0 4px 14px rgba(25, 118, 210, 0.25)",
                  "&:hover": {
                    backgroundColor: "#1565c0",
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
              p: 2.5,
              display: "flex",
              alignItems: "flex-end", // so icon aligns with bottom of growing text field
              borderTop: "1px solid #f0f0f0",
              backgroundColor: "#fff",
            }}
          >
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={6} // set max height before scrolling inside input
              variant="outlined"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault(); // prevent newline
                  handleSendMessage(); // trigger send
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#f9f9f9",
                  paddingRight: "12px", // spacing for icon button
                  transition: "all 0.2s ease",
                  "& fieldset": {
                    borderColor: "#e0e0e0",
                  },
                  "&:hover fieldset": {
                    borderColor: "#bdbdbd",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#1976d2",
                  },
                },
                "& .MuiInputBase-input": {
                  padding: "14px 20px",
                  fontSize: "14px",
                },
              }}
            />
            <IconButton
              type="submit"
              disabled={isLoading || !input.trim()}
              sx={{
                ml: 1,
                backgroundColor: "#1976d2",
                color: "#fff",
                width: 48,
                height: 48,
                alignSelf: "flex-end", // aligns button with bottom of textarea
                borderRadius: "12px",
                "&:hover": {
                  backgroundColor: "#1565c0",
                },
                "&.Mui-disabled": {
                  backgroundColor: "#e0e0e0",
                  color: "#9e9e9e",
                },
              }}
            >
              {isLoading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Box>
        </>
      )}
    </Paper>
  )
}

export default ChatInterface
