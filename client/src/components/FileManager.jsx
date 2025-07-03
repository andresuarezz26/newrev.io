"use client"

import { useState, useEffect } from "react"

import {
  Box,
  IconButton,
  TextField,
  InputAdornment,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Tooltip,
  Button,
  alpha
} from "@mui/material"
import SearchIcon from "@mui/icons-material/Search"
import AddIcon from "@mui/icons-material/Add"
import RemoveIcon from "@mui/icons-material/Remove"
import FolderIcon from "@mui/icons-material/Folder"
import FolderOpenIcon from "@mui/icons-material/FolderOpen"
import CodeIcon from "@mui/icons-material/Code"
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import RefreshIcon from '@mui/icons-material/Refresh'
import api from "../services/api"

/**
 * FileNode component renders a single file or folder in the tree
 */
const FileNode = ({ item, depth, onFileClick, inchatFiles, onToggleFile }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = () => {
    if (item.type === "folder") {
      setIsExpanded(!isExpanded)
    } else {
      onFileClick(item.path)
    }
  }

  const isInChat = item.type === 'file' && inchatFiles.includes(item.path)

  return (
    <div style={{ userSelect: 'none' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          pl: depth * 2 + 1,
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          backgroundColor: isInChat ? alpha('#007acc', 0.15) : 'transparent',
          borderLeft: isInChat ? '2px solid #007acc' : '2px solid transparent',
          '&:hover': {
            backgroundColor: isInChat ? alpha('#007acc', 0.2) : alpha('#ffffff', 0.05),
          }
        }}
        onClick={handleClick}
      >
        {item.type === "folder" && (
          <Box sx={{ color: '#888888', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? 
              <KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> : 
              <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
            }
          </Box>
        )}
        
        {item.type === "folder" ? (
          <FolderIcon fontSize="small" sx={{ color: '#888888' }} />
        ) : (
          <CodeIcon fontSize="small" sx={{ color: '#888888' }} />
        )}
        
        <Typography 
          sx={{ 
            fontSize: '13px',
            color: isInChat ? '#007acc' : '#e0e0e0',
            fontWeight: isInChat ? 500 : 400,
            flexGrow: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          {item.name}
        </Typography>
        
        {item.type === 'file' && (
          <Tooltip title={isInChat ? "Remove from chat" : "Add to chat"}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFile(item.path);
              }}
              sx={{
                color: isInChat ? "#ff6b6b" : "#007acc",
                width: 24,
                height: 24,
                "&:hover": {
                  backgroundColor: isInChat ? alpha("#ff6b6b", 0.1) : alpha("#007acc", 0.1),
                },
              }}
            >
              {isInChat ? <RemoveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      
      {item.type === "folder" && isExpanded && item.children && (
        <div>
          {item.children.map((child, index) => (
            <FileNode 
              key={`${child.path}-${index}`} 
              item={child} 
              depth={depth + 1} 
              onFileClick={onFileClick}
              inchatFiles={inchatFiles}
              onToggleFile={onToggleFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const FileManager = ({ onFileSelect, selectedProject, isInitialized, onOpenProject }) => {
  const [files, setFiles] = useState([])
  const [fileTree, setFileTree] = useState([])
  const [inchatFiles, setInchatFiles] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)

  // Get file extension
  const getFileExtension = (filename) => {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2)
  }
  
  // Get file icon based on extension
  const getFileIcon = (filename) => {
    const ext = getFileExtension(filename).toLowerCase()
    
    // Return appropriate icon based on file type
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb'].includes(ext)) {
      return <CodeIcon fontSize="small" sx={{ color: '#888888' }} />
    }
    
    return <FolderIcon fontSize="small" sx={{ color: '#888888' }} />
  }

  const handleFileClick = (file) => {
    onFileSelect(file)
  }

  // Fetch files function that can be reused for initial load and refresh
  const fetchFiles = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
        setError(null)
      }
      
      const response = await api.getFiles()
      if (response.status === "success") {
        const allFiles = response.all_files || []
        setFiles(allFiles)
        setInchatFiles(response.inchat_files || [])
        
        // Use buildFileTree to create the file tree structure
        const tree = buildFileTree(allFiles)
        setFileTree(tree)
        console.log('File Tree Structure:', tree)
        
        if (isRefresh) {
          // Show success feedback for refresh
          console.log('Files refreshed successfully')
        }
      } else {
        setError("Failed to fetch files")
      }
    } catch (error) {
      setError("Error fetching files: " + error.message)
    } finally {
      if (isRefresh) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }

  // Handle manual refresh using dedicated refresh endpoint
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setError(null)
      
      const response = await api.refreshFiles()
      if (response.status === "success") {
        const allFiles = response.all_files || []
        setFiles(allFiles)
        setInchatFiles(response.inchat_files || [])
        
        // Use buildFileTree to create the file tree structure
        const tree = buildFileTree(allFiles)
        setFileTree(tree)
        console.log('Files refreshed successfully:', response.message)
      } else {
        setError("Failed to refresh files")
      }
    } catch (error) {
      setError("Error refreshing files: " + error.message)
      console.error('Refresh error:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  // Refresh files when project changes
  useEffect(() => {
    if (isInitialized && selectedProject) {
      console.log('Project changed, refreshing files for:', selectedProject)
      // Clear any existing error state first
      setError(null)
      handleRefresh() // Use the proper refresh method
    }
  }, [selectedProject, isInitialized])
  
  // Also refresh when project changes, regardless of initialized state
  // This handles cases where project is selected from settings
  useEffect(() => {
    if (selectedProject) {
      console.log('Selected project changed:', selectedProject)
      // Reset error state when project changes
      setError(null)
      // Fetch files with basic method if not initialized yet
      if (!isInitialized) {
        fetchFiles()
      }
    }
  }, [selectedProject])

  const handleAddFile = async (filename) => {
    if (inchatFiles.includes(filename)) return

    try {
      setIsLoading(true)
      const response = await api.addFile(filename)
      if (response.status === "success") {
        setInchatFiles((prev) => [...prev, filename])
      }
    } catch (error) {
      setError("Error adding file: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveFile = async (filename) => {
    if (!inchatFiles.includes(filename)) return

    try {
      setIsLoading(true)
      const response = await api.removeFile(filename)
      if (response.status === "success") {
        setInchatFiles((prev) => prev.filter((f) => f !== filename))
      }
    } catch (error) {
      setError("Error removing file: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleFile = async (filename) => {
    if (inchatFiles.includes(filename)) {
      await handleRemoveFile(filename)
    } else {
      await handleAddFile(filename)
    }
  }

  const filteredFiles = (() => {
    const matchingFiles = files.filter((file) => file.toLowerCase().includes(searchTerm.toLowerCase()));
    const inChatMatching = matchingFiles.filter(file => inchatFiles.includes(file));
    const notInChatMatching = matchingFiles.filter(file => !inchatFiles.includes(file));
    return [...inChatMatching, ...notInChatMatching];
  })();

  if (isLoading && files.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
        <CircularProgress sx={{ color: "#007acc" }} />
      </Box>
    )
  }

  // Show file manager with proper UI even when there's an error
  const showEmptyState = error || (!isInitialized || !selectedProject);

  // Filter the file tree based on search term
  const filterTree = (tree, term) => {
    if (!term) return tree;
    
    const filtered = [];
    
    const filterNode = (node) => {
      // Check if this node matches
      const matches = node.path.toLowerCase().includes(term.toLowerCase());
      
      if (matches) {
        return true;
      }
      
      // For folders, check if any children match
      if (node.type === 'folder' && node.children) {
        const filteredChildren = node.children.filter(filterNode);
        
        if (filteredChildren.length > 0) {
          // Create a copy of the folder with only matching children
          const folderCopy = { ...node, children: filteredChildren };
          return true;
        }
      }
      
      return false;
    };
    
    return tree.filter(filterNode);
  };
  
  const filteredTree = filterTree(fileTree, searchTerm);

  return (
    <Paper
      elevation={0}
      sx={{
        maxHeight: "calc(100vh - 200px)",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "none",
        border: "none",
        borderRadius: "0",
        backgroundColor: "#1e1e1e",
      }}
    >
      <Box sx={{ p: 2.5, borderBottom: "1px solid #404040" }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 2 
        }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: "16px",
              color: "#e0e0e0",
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            <FolderIcon sx={{ color: '#888888', fontSize: 20 }} />
            Project Files
          </Typography>
          
          <Tooltip title={isRefreshing ? "Refreshing..." : "Refresh file list"}>
            <IconButton
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              sx={{
                color: '#888888',
                '&:hover': {
                  color: '#e0e0e0',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
                '&:disabled': {
                  color: '#444444',
                },
              }}
            >
              <RefreshIcon 
                sx={{ 
                  fontSize: 18,
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': {
                      transform: 'rotate(0deg)',
                    },
                    '100%': {
                      transform: 'rotate(360deg)',
                    },
                  },
                }} 
              />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Selected Files Section */}
        {inchatFiles.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: "#888888",
                fontSize: "11px",
                mb: 1,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              }}
            >
              Selected Files
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {inchatFiles.map((file) => (
                <Chip
                  key={file}
                  label={file}
                  size="small"
                  onDelete={() => handleToggleFile(file)}
                  sx={{
                    backgroundColor: alpha('#007acc', 0.2),
                    color: '#007acc',
                    fontSize: '12px',
                    height: '24px',
                    '& .MuiChip-label': {
                      px: 1,
                      fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
                    },
                    '& .MuiChip-deleteIcon': {
                      color: '#007acc',
                      fontSize: '16px',
                      '&:hover': {
                        color: '#ff6b6b'
                      }
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": {
              borderRadius: "6px",
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
                borderColor: "#007acc",
              },
            },
            "& .MuiInputBase-input": {
              padding: "10px 12px",
              fontSize: "13px",
              color: "#ffffff",
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              "&::placeholder": {
                color: "#888888",
                opacity: 1,
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#888888", fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
          <Chip 
            label={`${inchatFiles.length} files in chat`} 
            size="small"
            sx={{ 
              backgroundColor: inchatFiles.length > 0 ? alpha('#007acc', 0.2) : '#404040',
              color: inchatFiles.length > 0 ? '#007acc' : '#888888',
              fontWeight: 400,
              borderRadius: '6px',
              fontSize: '12px',
              height: '24px',
              '& .MuiChip-label': {
                px: 1,
                fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              }
            }}
          />
        </Box>
      </Box>

      <Box sx={{ overflow: "auto", flex: 1, p: 1 }}>
        {isLoading && files.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
            <CircularProgress sx={{ color: "#007acc" }} />
          </Box>
        ) : showEmptyState ? (
          // Empty state with action buttons
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '300px',
            p: 3,
            textAlign: 'center'
          }}>
            <FolderOpenIcon sx={{ fontSize: 48, color: '#555555', mb: 2 }} />
            <Typography
              variant="h6"
              sx={{
                fontSize: "16px",
                color: "#888888",
                mb: 1,
                fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              }}
            >
              {!selectedProject ? 'No Project Selected' : 'Project Not Loaded'}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: "13px",
                color: "#666666",
                mb: 3,
                maxWidth: '250px',
                fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
              }}
            >
              {!selectedProject 
                ? 'Select a project directory to start working with your files' 
                : error
                ? 'There was an issue loading the project files'
                : 'Project is initializing...'}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column', alignItems: 'center' }}>
              {/* Refresh button - always show */}
              <Button
                variant="outlined"
                startIcon={<RefreshIcon sx={{ 
                  fontSize: 16,
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }} />}
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                sx={{
                  borderColor: '#404040',
                  color: '#e0e0e0',
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#505050',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)'
                  },
                  '&:disabled': {
                    borderColor: '#2a2a2a',
                    color: '#555555'
                  }
                }}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Files'}
              </Button>
              
              {/* Open project button - only show if we can open projects */}
              {onOpenProject && (
                <Button
                  variant="contained"
                  startIcon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
                  onClick={onOpenProject}
                  sx={{
                    backgroundColor: '#007acc',
                    color: '#ffffff',
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: '#0066aa'
                    }
                  }}
                >
                  Open Project
                </Button>
              )}
            </Box>
          </Box>
        ) : searchTerm ? (
          // Flat list view when searching
          <Box sx={{ mt: 1 }}>
            {filteredFiles.map((file) => {
              const isInChat = inchatFiles.includes(file);
              return (
                <Box
                  key={file}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isInChat ? alpha('#007acc', 0.15) : 'transparent',
                    borderLeft: isInChat ? '2px solid #007acc' : '2px solid transparent',
                    '&:hover': {
                      backgroundColor: isInChat ? alpha('#007acc', 0.2) : alpha('#ffffff', 0.05),
                    }
                  }}
                  onClick={() => handleToggleFile(file)}
                >
                  <CodeIcon fontSize="small" sx={{ color: '#888888' }} />
                  <Typography 
                    sx={{ 
                      fontSize: '13px',
                      color: isInChat ? '#007acc' : '#e0e0e0',
                      fontWeight: isInChat ? 500 : 400,
                      flexGrow: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
                    }}
                  >
                    {file}
                  </Typography>
                  <Tooltip title={isInChat ? "Remove from chat" : "Add to chat"}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFile(file);
                      }}
                      sx={{
                        color: isInChat ? "#ff6b6b" : "#007acc",
                        width: 24,
                        height: 24,
                        "&:hover": {
                          backgroundColor: isInChat ? alpha("#ff6b6b", 0.1) : alpha("#007acc", 0.1),
                        },
                      }}
                    >
                      {isInChat ? <RemoveIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
            {filteredFiles.length === 0 && (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <SearchIcon sx={{ fontSize: 32, color: "#555555", mb: 1 }} />
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "13px",
                    color: "#888888",
                    fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
                  }}
                >
                  No matching files found
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          // Tree view when not searching
          <Box sx={{ mt: 1 }}>
            {filteredTree.map((item, index) => (
              <FileNode 
                key={`${item.path}-${index}`} 
                item={item} 
                depth={0} 
                onFileClick={handleFileClick}
                inchatFiles={inchatFiles}
                onToggleFile={handleToggleFile}
              />
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  )
}


function buildFileTree(paths) {
  const root = [];

  function findOrCreateFolder(children, folderName, folderPath) {
    let folder = children.find(item => item.name === folderName && item.type === 'folder');
    if (!folder) {
      folder = {
        name: folderName,
        type: 'folder',
        children: [],
        path: folderPath,
      };
      children.push(folder);
    }
    return folder;
  }

  // First, build the tree structure
  for (const fullPath of paths) {
    const parts = fullPath.split('/').filter(Boolean); // split and remove empty segments
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = (i === parts.length - 1);

      if (isFile) {
        // Add file
        currentLevel.push({
          name,
          type: 'file',
          path: fullPath,
        });
      } else {
        // Add or find folder
        const pathUpToHere = parts.slice(0, i + 1).join('/');
        const folder = findOrCreateFolder(currentLevel, name, pathUpToHere);
        currentLevel = folder.children;
      }
    }
  }

  // Function to sort a level of the tree
  function sortTreeLevel(level) {
    if (!level || level.length === 0) return level;

    // Separate folders and files
    const folders = level.filter(item => item.type === 'folder');
    const files = level.filter(item => item.type === 'file');

    // Sort each group alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    // Recursively sort children of each folder
    const sortedFolders = folders.map(folder => ({
      ...folder,
      children: sortTreeLevel(folder.children)
    }));

    // Return combined array with folders first, then files
    return [...sortedFolders, ...files];
  }

  // Sort the entire tree structure
  return sortTreeLevel(root);
}

export default FileManager