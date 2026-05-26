import React, { useState } from 'react'
import {
  Box, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Typography, Button, Paper, Alert, Divider
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { api } from '../../services/api'

export default function PointCommandsTab({ client }) {
  const [form, setForm] = useState({
    command_type: 'direct_operate',
    group: 12,
    variation: 1,
    index: 0,
    value: '1',
    count: 1,
    on_time: 1000,
    off_time: 1000,
    control_code: 'pulse_on',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const isCROB = form.group === 12

  const handleSend = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await api.masterPointCommand(client.id, form)
      setResult({ type: 'success', message: 'Command executed successfully' })
    } catch (err) {
      setResult({ type: 'error', message: `Failed: ${err.response?.data?.detail || err.message}` })
    }
    setLoading(false)
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Point Commands</Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={3}>
            <FormControl fullWidth>
              <InputLabel>Command Type</InputLabel>
              <Select value={form.command_type} label="Command Type"
                onChange={e => update('command_type', e.target.value)}>
                <MenuItem value="sbo">Select Before Operate (SBO)</MenuItem>
                <MenuItem value="direct_operate">Direct Operate</MenuItem>
                <MenuItem value="direct_no_ack">Direct Operate No ACK</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={2}>
            <FormControl fullWidth>
              <InputLabel>Group</InputLabel>
              <Select value={form.group} label="Group"
                onChange={e => update('group', e.target.value)}>
                <MenuItem value={12}>12 - CROB</MenuItem>
                <MenuItem value={41}>41 - Analog Output</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth label="Variation" type="number" value={form.variation}
              onChange={e => update('variation', parseInt(e.target.value))} />
          </Grid>
          <Grid item xs={2}>
            <TextField fullWidth label="Point Index" type="number" value={form.index}
              onChange={e => update('index', parseInt(e.target.value))} />
          </Grid>
          <Grid item xs={3}>
            <TextField fullWidth label="Value" value={form.value}
              onChange={e => update('value', e.target.value)} />
          </Grid>

          {isCROB && (
            <>
              <Grid item xs={3}>
                <FormControl fullWidth>
                  <InputLabel>Control Code</InputLabel>
                  <Select value={form.control_code} label="Control Code"
                    onChange={e => update('control_code', e.target.value)}>
                    <MenuItem value="nul">NUL</MenuItem>
                    <MenuItem value="pulse_on">Pulse On</MenuItem>
                    <MenuItem value="pulse_off">Pulse Off</MenuItem>
                    <MenuItem value="latch_on">Latch On</MenuItem>
                    <MenuItem value="latch_off">Latch Off</MenuItem>
                    <MenuItem value="close">Close</MenuItem>
                    <MenuItem value="trip">Trip</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={3}>
                <TextField fullWidth label="Count" type="number" value={form.count}
                  onChange={e => update('count', parseInt(e.target.value))} />
              </Grid>
              <Grid item xs={3}>
                <TextField fullWidth label="On Time (ms)" type="number" value={form.on_time}
                  onChange={e => update('on_time', parseInt(e.target.value))} />
              </Grid>
              <Grid item xs={3}>
                <TextField fullWidth label="Off Time (ms)" type="number" value={form.off_time}
                  onChange={e => update('off_time', parseInt(e.target.value))} />
              </Grid>
            </>
          )}
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleSend} disabled={loading}>
            {loading ? 'Sending...' : 'Send Command'}
          </Button>
        </Box>
      </Paper>

      {result && (
        <Alert severity={result.type} sx={{ mt: 2 }}>{result.message}</Alert>
      )}
    </Box>
  )
}
