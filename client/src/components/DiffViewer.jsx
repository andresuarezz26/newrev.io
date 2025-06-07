import React from 'react';
import { Box, Typography, Divider } from '@mui/material';

const parseUnifiedDiff = (diffContent) => {
  const lines = diffContent.split('\n');
  const parsed = [];
  let currentFile = null;
  let currentHunk = null;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      const fileNameMatch = line.match(/a\/(.+?) b\/(.+)/);
      currentFile = fileNameMatch ? fileNameMatch[2] : 'Unknown File';
      parsed.push({
        filePath: currentFile,
        hunks: []
      });
    } else if (line.startsWith('@@')) {
      // Parse hunk header for line numbers
      const hunkMatch = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
      if (hunkMatch) {
        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldLines: hunkMatch[2] ? parseInt(hunkMatch[2]) : 1,
          newStart: parseInt(hunkMatch[3]),
          newLines: hunkMatch[4] ? parseInt(hunkMatch[4]) : 1,
          changes: []
        };
        parsed[parsed.length - 1].hunks.push(currentHunk);
      }
    } else if (currentHunk && !line.startsWith('--- ') && !line.startsWith('+++ ') && !line.startsWith('index ')) {
      const type = line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : 'unchanged';
      const content = line.substring(1) || ' '; // Handle empty lines
      currentHunk.changes.push({ type, content });
    }
  }
  return parsed;
};

const DiffViewer = ({ diff, maxHeight = '300px' }) => {
  if (!diff) return null;

  const parsedDiffs = parseUnifiedDiff(diff);

  return (
    <Box
      sx={{
        maxHeight,
        overflowY: 'auto',
        backgroundColor: '#1e1e1e',
        borderRadius: '6px',
        border: '1px solid #404040',
        mt: 2,
        fontFamily: '"SF Mono", "Monaco", "Menlo", "Consolas", monospace',
        fontSize: '13px',
        lineHeight: '20px',
        '& pre': {
          margin: 0,
          padding: '12px 0',
        },
      }}
    >
      {parsedDiffs.map((fileDiff, fileIndex) => (
        <Box key={fileIndex} sx={{ mb: fileIndex < parsedDiffs.length - 1 ? 2 : 0 }}>
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: '1px solid #404040',
              backgroundColor: '#252525',
            }}
          >
            <Typography
              sx={{
                color: '#e0e0e0',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {fileDiff.filePath}
            </Typography>
          </Box>
          
          {fileDiff.hunks.map((hunk, hunkIndex) => (
            <Box key={hunkIndex} sx={{ position: 'relative' }}>
              <Box
                sx={{
                  px: 2,
                  py: 0.5,
                  backgroundColor: '#2d2d2d',
                  borderBottom: '1px solid #404040',
                  color: '#808080',
                  fontSize: '12px',
                }}
              >
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </Box>
              <pre style={{ margin: 0 }}>
                {hunk.changes.map((change, lineIndex) => (
                  <Typography
                    key={lineIndex}
                    component="div"
                    sx={{
                      display: 'block',
                      px: 2,
                      backgroundColor:
                        change.type === 'added' ? 'rgba(40, 167, 69, 0.15)' :
                        change.type === 'removed' ? 'rgba(203, 36, 49, 0.15)' :
                        'transparent',
                      color:
                        change.type === 'added' ? '#85e89d' :
                        change.type === 'removed' ? '#f97583' :
                        '#e0e0e0',
                      '&::before': {
                        content: '"' + (change.type === 'added' ? '+' : change.type === 'removed' ? '-' : ' ') + '"',
                        position: 'absolute',
                        left: '8px',
                        color: change.type === 'unchanged' ? '#404040' : 'inherit',
                      }
                    }}
                  >
                    <span style={{ marginLeft: '12px' }}>{change.content}</span>
                  </Typography>
                ))}
              </pre>
            </Box>
          ))}
          {fileIndex < parsedDiffs.length - 1 && (
            <Divider sx={{ borderColor: '#404040' }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

export default DiffViewer; 