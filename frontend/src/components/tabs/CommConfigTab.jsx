import React, { useState } from 'react'
import {
  Box, Grid, TextField, Select, MenuItem, FormControl, InputLabel,
  Typography, Button, Paper, Snackbar, Alert
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { api } from '../../services/api'

export default function CommConfigTab({ client, onUpdated }) {
  const [config, setConfig] = useState({
    name: client.name,
    comm_mode: client.comm_mode,
    master_address: client.master_address,
    outstation_address: client.outstation_address,
    serial_config: { ...client.serial_config },
    tcp_config: { ...client.tcp_config },
    udp_config: { ...client.udp_config },
    timeout_config: { ...client.timeout_config },
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const update = (path, value) => {
    setConfig(prev => {
      const next = { ...prev }
      const parts = path.split('.')
      if (parts.length === 2) {
        next[parts[0]] = { ...next[parts[0]], [parts[1]]: value }
      } else {
        next[path] = value
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.updateMasterConfig(client.id, config)
      onUpdated(updated)
      setToast({ severity: 'success', message: 'Connection configuration saved.' })
    } catch (err) {
      console.error('Save failed:', err)
      setToast({
        severity: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to save connection configuration.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Master Connection Configuration</Typography>
        <Button startIcon={<SaveIcon />} variant="contained" size="small" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* General */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>General</Typography>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={4}>
                <TextField fullWidth label="Master Name" value={config.name}
                  onChange={e => update('name', e.target.value)} />
              </Grid>
              <Grid item xs={2}>
                <FormControl fullWidth>
                  <InputLabel>Mode</InputLabel>
                  <Select value={config.comm_mode} label="Mode"
                    onChange={e => update('comm_mode', e.target.value)}>
                    <MenuItem value="serial">Serial</MenuItem>
                    <MenuItem value="tcp">TCP</MenuItem>
                    <MenuItem value="udp">UDP</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={3}>
                <TextField fullWidth label="Master Address" type="number"
                  value={config.master_address}
                  onChange={e => update('master_address', parseInt(e.target.value))} />
              </Grid>
              <Grid item xs={3}>
                <TextField fullWidth label="Outstation Address" type="number"
                  value={config.outstation_address}
                  onChange={e => update('outstation_address', parseInt(e.target.value))} />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Serial Config */}
        {config.comm_mode === 'serial' && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Serial Port</Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={2}>
                  <TextField fullWidth label="Port" value={config.serial_config.port}
                    onChange={e => update('serial_config.port', e.target.value)} />
                </Grid>
                <Grid item xs={2}>
                  <FormControl fullWidth>
                    <InputLabel>Baud Rate</InputLabel>
                    <Select value={config.serial_config.baud_rate} label="Baud Rate"
                      onChange={e => update('serial_config.baud_rate', e.target.value)}>
                      {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(b =>
                        <MenuItem key={b} value={b}>{b}</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={2}>
                  <FormControl fullWidth>
                    <InputLabel>Data Bits</InputLabel>
                    <Select value={config.serial_config.data_bits} label="Data Bits"
                      onChange={e => update('serial_config.data_bits', e.target.value)}>
                      {[7, 8].map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={2}>
                  <FormControl fullWidth>
                    <InputLabel>Parity</InputLabel>
                    <Select value={config.serial_config.parity} label="Parity"
                      onChange={e => update('serial_config.parity', e.target.value)}>
                      {['none', 'even', 'odd'].map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={2}>
                  <FormControl fullWidth>
                    <InputLabel>Stop Bits</InputLabel>
                    <Select value={config.serial_config.stop_bits} label="Stop Bits"
                      onChange={e => update('serial_config.stop_bits', e.target.value)}>
                      {[1, 1.5, 2].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={2}>
                  <FormControl fullWidth>
                    <InputLabel>Flow Control</InputLabel>
                    <Select value={config.serial_config.flow_control} label="Flow Control"
                      onChange={e => update('serial_config.flow_control', e.target.value)}>
                      {['none', 'xon_xoff', 'rts_cts'].map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* TCP Config */}
        {config.comm_mode === 'tcp' && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>TCP Connection</Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <TextField fullWidth label="IP Address" value={config.tcp_config.ip_address}
                    onChange={e => update('tcp_config.ip_address', e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth label="Port" type="number" value={config.tcp_config.port}
                    onChange={e => update('tcp_config.port', parseInt(e.target.value))} />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* UDP Config */}
        {config.comm_mode === 'udp' && (
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>UDP Connection</Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <TextField fullWidth label="IP Address" value={config.udp_config.ip_address}
                    onChange={e => update('udp_config.ip_address', e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth label="Port" type="number" value={config.udp_config.port}
                    onChange={e => update('udp_config.port', parseInt(e.target.value))} />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Timeouts */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Timeouts (ms)</Typography>
            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
              <Grid item xs={4}>
                <TextField fullWidth label="Link Layer Timeout" type="number"
                  value={config.timeout_config.link_layer_timeout}
                  onChange={e => update('timeout_config.link_layer_timeout', parseInt(e.target.value))} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth label="Application Layer Timeout" type="number"
                  value={config.timeout_config.application_layer_timeout}
                  onChange={e => update('timeout_config.application_layer_timeout', parseInt(e.target.value))} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth label="Command Timeout" type="number"
                  value={config.timeout_config.command_timeout}
                  onChange={e => update('timeout_config.command_timeout', parseInt(e.target.value))} />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)} sx={{ maxWidth: 520 }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
