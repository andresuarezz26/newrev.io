import { useState, useEffect, useRef } from "react"
import { 
  Button, 
  TextField, 
  Paper, 
  Typography, 
  Box, 
  CircularProgress, 
  IconButton,
  MenuList,
  MenuItem,
  Popper,
  ClickAwayListener,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material"
import SendIcon from "@mui/icons-material/Send"
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { ExpandMore, AllInclusive, ChatBubbleOutline, DiamondOutlined, Check, Edit } from "@mui/icons-material"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import api, { addEventListener, removeEventListener, SESSION_ID } from "../services/api"
import DiffViewer from './DiffViewer'

const modeOptions = [
  {
    value: "code",
    label: "Code",
    icon: <DiamondOutlined />,
  },
  {
    value: "architect",
    label: "Architect",
    icon: <AllInclusive />,
  },
  {
    value: "ask",
    label: "Ask",
    icon: <ChatBubbleOutline />,
  },
]

function CursorModeSelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)

  const selectedOption = modeOptions.find((option) => option.value === value) || modeOptions[0]

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen)
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleSelect = (optionValue) => {
    onChange(optionValue)
    setOpen(false)
  }

  return (
    <Box>
      {/* Trigger Button */}
      <Button
        ref={anchorRef}
        onClick={handleToggle}
        startIcon={selectedOption.icon}
        endIcon={
          <ExpandMore
            sx={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              fontSize: "x-small",
            }}
          />
        }
        sx={{
          backgroundColor: "#2a2a2a",
          color: "white",
          border: "1px solid #404040",
          borderRadius: "6px",
          textTransform: "none",
          minWidth: 'auto',
          height: '28px',
          justifyContent: "space-between",
          px: 1,
          py: 0.25,
          "&:hover": {
            backgroundColor: "#333333",
          },
          "& .MuiButton-startIcon": {
            marginRight: 0.5,
            "& .MuiSvgIcon-root": {
              fontSize: "0.75rem",
            },
          },
          "& .MuiButton-endIcon": {
            marginLeft: 0.5,
            "& .MuiSvgIcon-root": {
              fontSize: "0.875rem",
            },
          },
        }}
      >
        <Typography variant="caption" sx={{ color: "white", fontSize: "10px" }}>
          {selectedOption.label}
        </Typography>
      </Button>

      {/* Dropdown Menu */}
      <Popper open={open} anchorEl={anchorRef.current} placement="top-start" sx={{ zIndex: 1300 }}>
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            sx={{
              backgroundColor: "#2a2a2a",
              border: "1px solid #404040",
              borderRadius: "8px",
              mt: 0.5,
              minWidth: 200,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
            }}
          >
            {/* Header */}
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid #404040",
              }}
            >
              <Typography variant="caption" sx={{ color: "#888888" }}>
                Select Mode
              </Typography>
            </Box>

            {/* Menu Items */}
            <MenuList sx={{ py: 0.5 }}>
              {modeOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  selected={option.value === value}
                  sx={{
                    px: 2,
                    py: 1,
                    backgroundColor: option.value === value ? "#0066cc" : "transparent",
                    "&:hover": {
                      backgroundColor: option.value === value ? "#0066cc" : "#333333",
                    },
                    "&.Mui-selected": {
                      backgroundColor: "#0066cc",
                      "&:hover": {
                        backgroundColor: "#0066cc",
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: "white" }}>{option.icon}</ListItemIcon>
                  <ListItemText
                    primary={option.label}
                    sx={{
                      "& .MuiListItemText-primary": {
                        color: "white",
                        fontSize: "0.875rem",
                      },
                    }}
                  />
                  {option.value === value && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Edit sx={{ fontSize: 10, color: "white" }} />
                      <Check sx={{ fontSize: 10, color: "white" }} />
                    </Box>
                  )}
                </MenuItem>
              ))}
            </MenuList>

            <Divider sx={{ borderColor: "#404040" }} />

            {/* Footer */}
            <Box
              sx={{
                px: 2,
                py: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <AllInclusive sx={{ fontSize: 10, color: "#888888" }} />
                <Typography variant="caption" sx={{ color: "#888888", fontSize: "10px" }}>
                  Current Mode
                </Typography>
                <ExpandMore sx={{ fontSize: 10, color: "#888888" }} />
              </Box>
              <Typography variant="caption" sx={{ color: "#888888" }}>
                {selectedOption.label}
              </Typography>
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  )
}

const ChatInterface = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [streamingContent, setStreamingContent] = useState("")
  const [editorContent, setEditorContent] = useState("")
  const [reflectionContent, setReflectionContent] = useState("")
  const [mode, setMode] = useState('code')
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const isUserScrollingRef = useRef(false)

  const parseStreamingContent = (content) => {
    // Regex to match markdown code blocks (```language code ```)
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    // Find all code blocks
    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before the code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }

      // Add the code block
      parts.push({
        type: 'code',
        language: match[1] || 'javascript', // Default to javascript if no language specified
        content: match[2]
      });

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    return parts;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Effect to initialize the session
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await api.initSession({
          mode,
        })
        if (response.status === "success") {
          setMessages(response.messages || [])
          setMode(response.mode || 'code')
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

    const handleEditorChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        console.log('Received editor chunk')
        setEditorContent((prev) => prev + (data.chunk || ""))
      }
    }

    const handleEditorComplete = (data) => {
      if (data.session_id === SESSION_ID) {
        if (editorContent) {
          setMessages((prev) => [...prev, { role: "editor", content: editorContent }])
        }
        setEditorContent("")
      }
    }

    const handleReflectionStart = (data) => {
      if (data.session_id === SESSION_ID) {
        setMessages((prev) => [...prev, { role: "info", content: "Reflecting on the changes..." }])
      }
    }

    const handleReflectionChunk = (data) => {
      if (data.session_id === SESSION_ID) {
        setReflectionContent((prev) => prev + (data.chunk || ""))
      }
    }

    const handleReflectionComplete = (data) => {
      if (data.session_id === SESSION_ID) {
        if (reflectionContent) {
          setMessages((prev) => [...prev, { role: "reflection", content: reflectionContent }])
        }
        setReflectionContent("")
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
    addEventListener("editor_chunk", handleEditorChunk)
    addEventListener("editor_complete", handleEditorComplete)
    addEventListener("reflection_start", handleReflectionStart)
    addEventListener("reflection_chunk", handleReflectionChunk)
    addEventListener("reflection_complete", handleReflectionComplete)
    addEventListener("files_edited", handleFilesEdited)
    addEventListener("commit", handleCommit)
    addEventListener("error", handleError)

    return () => {
      removeEventListener("message_chunk", handleMessageChunk)
      removeEventListener("message_complete", handleMessageComplete)
      removeEventListener("editor_chunk", handleEditorChunk)
      removeEventListener("editor_complete", handleEditorComplete)
      removeEventListener("reflection_start", handleReflectionStart)
      removeEventListener("reflection_chunk", handleReflectionChunk)
      removeEventListener("reflection_complete", handleReflectionComplete)
      removeEventListener("files_edited", handleFilesEdited)
      removeEventListener("commit", handleCommit)
      removeEventListener("error", handleError)
    }
  }, [streamingContent, editorContent, reflectionContent])

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input
    setInput("")
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    
    isUserScrollingRef.current = false

    try {
      await api.sendMessage(userMessage, {
        mode
      })
    } catch (error) {
      console.error("Error sending message:", error)
      setIsLoading(false)
      setMessages((prev) => [...prev, { role: "error", content: "Failed to send message. Please try again." }])
    }
  }

  const handleModeChange = async (newMode) => {
    try {
      const response = await api.setMode({
        mode: newMode
      });
      
      if (response.status === "success") {
        setMode(newMode);
      }
    } catch (error) {
      console.error("Error changing mode:", error);
      setMessages((prev) => [...prev, { 
        role: "error", 
        content: "Failed to change mode. Please try again." 
      }]);
    }
  };

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
    editor: {
      backgroundColor: '#1a365d',
      color: '#90cdf4',
      borderRadius: '8px',
      marginRight: 'auto',
      maxWidth: '80%',
      border: '1px solid #2d5a87',
    },
    reflection: {
      backgroundColor: '#2d3748',
      color: '#a0aec0',
      borderRadius: '8px',
      marginRight: 'auto',
      maxWidth: '80%',
      border: '1px solid #4a5568',
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
            {!hasDiff && role !== 'assistant' && content}
            {role === 'assistant' && parseStreamingContent(content).map((part, idx) => (
              part.type === 'text' ? (
                <span key={idx}>{part.content}</span>
              ) : (
                <Box key={idx} sx={{ my: 2, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: 5, 
                      right: 5, 
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    {part.language && (
                      <Typography variant="caption" sx={{ color: '#aaa', backgroundColor: 'rgba(0,0,0,0.3)', px: 1, py: 0.5, borderRadius: 1 }}>
                        {part.language}
                      </Typography>
                    )}
                    <IconButton 
                      size="small" 
                      onClick={() => copyToClipboard(part.content)}
                      sx={{ 
                        color: '#aaa', 
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        '&:hover': { 
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          color: '#fff'
                        }
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <SyntaxHighlighter
                    language={part.language}
                    style={vscDarkPlus}
                    showLineNumbers={part.content.split('\n').length > 5}
                    customStyle={{
                      margin: 0,
                      borderRadius: '4px',
                      fontSize: '13px',
                    }}
                  >
                    {part.content}
                  </SyntaxHighlighter>
                </Box>
              )
            ))}
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
            sx={{
              p: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 2,
              borderBottom: "1px solid #404040",
              backgroundColor: "#1e1e1e",
            }}
          >
          </Box>

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
                    {parseStreamingContent(streamingContent).map((part, index) => (
                      part.type === 'text' ? (
                        <span key={index}>{part.content}</span>
                      ) : (
                        <Box key={index} sx={{ my: 2, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <Box 
                            sx={{ 
                              position: 'absolute', 
                              top: 5, 
                              right: 5, 
                              zIndex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}
                          >
                            {part.language && (
                              <Typography variant="caption" sx={{ color: '#aaa', backgroundColor: 'rgba(0,0,0,0.3)', px: 1, py: 0.5, borderRadius: 1 }}>
                                {part.language}
                              </Typography>
                            )}
                            <IconButton 
                              size="small" 
                              onClick={() => copyToClipboard(part.content)}
                              sx={{ 
                                color: '#aaa', 
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                '&:hover': { 
                                  backgroundColor: 'rgba(0,0,0,0.5)',
                                  color: '#fff'
                                }
                              }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          <SyntaxHighlighter
                            language={part.language}
                            style={vscDarkPlus}
                            showLineNumbers={part.content.split('\n').length > 5}
                            customStyle={{
                              margin: 0,
                              borderRadius: '4px',
                              fontSize: '13px',
                            }}
                          >
                            {part.content}
                          </SyntaxHighlighter>
                        </Box>
                      )
                    ))}
                  </Typography>
                </Paper>
              </Box>
            )}

            {editorContent && (
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
                    ...messageStyles.editor,
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
                    }}
                  >
                    {parseStreamingContent(editorContent).map((part, index) => (
                      part.type === 'text' ? (
                        <span key={index}>{part.content}</span>
                      ) : (
                        <Box key={index} sx={{ my: 2, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <SyntaxHighlighter
                            language={part.language}
                            style={vscDarkPlus}
                            showLineNumbers={part.content.split('\n').length > 5}
                            customStyle={{
                              margin: 0,
                              borderRadius: '4px',
                              fontSize: '13px',
                            }}
                          >
                            {part.content}
                          </SyntaxHighlighter>
                        </Box>
                      )
                    ))}
                  </Typography>
                </Paper>
              </Box>
            )}

            {reflectionContent && (
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
                    ...messageStyles.reflection,
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
                    }}
                  >
                    {parseStreamingContent(reflectionContent).map((part, index) => (
                      part.type === 'text' ? (
                        <span key={index}>{part.content}</span>
                      ) : (
                        <Box key={index} sx={{ my: 2, borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <SyntaxHighlighter
                            language={part.language}
                            style={vscDarkPlus}
                            showLineNumbers={part.content.split('\n').length > 5}
                            customStyle={{
                              margin: 0,
                              borderRadius: '4px',
                              fontSize: '13px',
                            }}
                          >
                            {part.content}
                          </SyntaxHighlighter>
                        </Box>
                      )
                    ))}
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
              flexDirection: "column",
              borderTop: "1px solid #404040",
              backgroundColor: "#1e1e1e",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
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
            <Box sx={{ display: "flex", justifyContent: "flex-start", mt: 1 }}>
              <CursorModeSelector value={mode} onChange={handleModeChange} />
            </Box>
          </Box>
        </>
      )}
    </Paper>
  )
}

export default ChatInterface
