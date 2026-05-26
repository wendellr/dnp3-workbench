import React, { useState } from 'react'
import { Box, Grid, Button, Typography, Paper, Alert } from '@mui/material'
import { api } from '../../services/api'

const commands = [
  { id: 'integrity_poll', label: 'Integrity Poll', desc: 'Read all Class 0 data (all static data)', color: 'primary' },
  { id: 'class1_poll', label: 'Class 1 Poll', desc: 'Read Class 1 event data', color: 'primary' },
  { id: 'class2_poll', label: 'Class 2 Poll', desc: 'Read Class 2 event data', color: 'primary' },
  { id: 'class3_poll', label: 'Class 3 Poll', desc: 'Read Class 3 event data', color: 'primary' },
  { id: 'time_sync', label: 'Time Sync', desc: 'Synchronize outstation time with master', color: 'secondary' },
  { id: 'cold_restart', label: 'Cold Restart', desc: 'Request outstation cold restart', color: 'error' },
  { id: 'warm_restart', label: 'Warm Restart', desc: 'Request outstation warm restart', color: 'warning' },
]

export default function StationCommandsTab({ client }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(null)

  const execute = async (cmd) => {
    setLoading(cmd)
    setResult(null)
    try {
      const res = await api.masterStationCommand(client.id, cmd)
      setResult({ type: 'success', message: `${cmd} executed successfully`, data: res })
    } catch (err) {
      setResult({ type: 'error', message: `${cmd} failed: ${err.response?.data?.detail || err.message}` })
    }
    setLoading(null)
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Station Commands</Typography>

      <Grid container spacing={1.5}>
        {commands.map(cmd => (
          <Grid item xs={6} md={4} key={cmd.id}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Button
                fullWidth variant="contained" color={cmd.color}
                onClick={() => execute(cmd.id)}
                disabled={loading === cmd.id}
                sx={{ mb: 0.5 }}
              >
                {loading === cmd.id ? 'Executing...' : cmd.label}
              </Button>
              <Typography variant="caption" color="textSecondary">{cmd.desc}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {result && (
        <Alert severity={result.type} sx={{ mt: 2 }}>{result.message}</Alert>
      )}
    </Box>
  )
}
