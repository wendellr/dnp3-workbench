import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, IconButton, Tooltip, Chip, Paper } from '@mui/material'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { createMasterWebSocket } from '../../services/api'

export default function TrafficMonitorTab({ client }) {
  const [frames, setFrames] = useState([])
  const containerRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const ws = createMasterWebSocket(client.id, 'traffic')
    wsRef.current = ws

    ws.onmessage = (event) => {
      const frame = JSON.parse(event.data)
      setFrames(prev => [...prev.slice(-500), frame])  // Keep last 500
    }

    ws.onerror = () => console.error('Traffic WS error')

    return () => { ws.close() }
  }, [client.id])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [frames])

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Traffic Monitor</Typography>
        <Box sx={{ flex: 1 }} />
        <Chip label={`${frames.length} frames`} size="small" sx={{ mr: 1 }} />
        <Tooltip title="Clear">
          <IconButton size="small" onClick={() => setFrames([])}>
            <DeleteSweepIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Paper
        ref={containerRef}
        variant="outlined"
        sx={{
          height: 400, overflow: 'auto', p: 1,
          bgcolor: '#1e1e1e', fontFamily: 'monospace', fontSize: 11,
        }}
      >
        {frames.map((frame, i) => (
          <Box key={i} sx={{ mb: 0.5 }}>
            <span style={{ color: frame.direction === 'TX' ? '#4fc3f7' : '#81c784' }}>
              [{frame.timestamp ? new Date(frame.timestamp * 1000).toLocaleTimeString() : '--:--:--'}]
            </span>
            <span style={{ color: frame.direction === 'TX' ? '#ff9800' : '#66bb6a', fontWeight: 600 }}>
              {' '}{frame.direction}{' '}
            </span>
            <span style={{ color: '#e0e0e0' }}>{frame.description}</span>
            <br />
            <span style={{ color: '#78909c' }}>{frame.hex || 'native runtime event'}</span>
          </Box>
        ))}
        {frames.length === 0 && (
          <Box sx={{ color: '#666', textAlign: 'center', mt: 10 }}>
            Waiting for traffic... Connect and execute commands to see DNP3 frames.
          </Box>
        )}
      </Paper>
    </Box>
  )
}
