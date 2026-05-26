import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, IconButton, Tooltip, Paper } from '@mui/material'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { createMasterWebSocket } from '../../services/api'

export default function LogViewerTab({ client }) {
  const [logs, setLogs] = useState([])
  const containerRef = useRef(null)

  useEffect(() => {
    const ws = createMasterWebSocket(client.id, 'logs')

    ws.onmessage = (event) => {
      const entry = JSON.parse(event.data)
      setLogs(prev => [...prev.slice(-1000), entry])
    }

    return () => { ws.close() }
  }, [client.id])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Event Log</Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Clear">
          <IconButton size="small" onClick={() => setLogs([])}>
            <DeleteSweepIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Paper
        ref={containerRef}
        variant="outlined"
        sx={{
          height: 400, overflow: 'auto', p: 1,
          bgcolor: '#fafafa', fontFamily: 'monospace', fontSize: 12,
        }}
      >
        {logs.map((entry, i) => (
          <Box key={i} sx={{ mb: 0.3 }}>
            <span style={{ color: '#1565c0' }}>[{entry.timestamp || '--'}]</span>
            {' '}
            <span style={{ color: entry.level === 'error' ? '#c62828' : entry.level === 'warning' ? '#ef6c00' : '#333' }}>
              {entry.message || JSON.stringify(entry)}
            </span>
          </Box>
        ))}
        {logs.length === 0 && (
          <Box sx={{ color: '#999', textAlign: 'center', mt: 10 }}>
            No log entries yet.
          </Box>
        )}
      </Paper>
    </Box>
  )
}
