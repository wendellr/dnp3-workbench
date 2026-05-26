import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import RefreshIcon from '@mui/icons-material/Refresh'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import DnsIcon from '@mui/icons-material/Dns'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import { api } from '../services/api'

const POINT_TYPES = [
  { value: 'binary', label: 'Binary Input', staticVariation: 'Group1Var2', eventVariation: 'Group2Var2', defaultValue: 'true' },
  { value: 'double_bit_binary', label: 'Double-bit Binary', staticVariation: 'Group3Var2', eventVariation: 'Group4Var2', defaultValue: '2' },
  { value: 'analog', label: 'Analog Input', staticVariation: 'Group30Var1', eventVariation: 'Group32Var1', defaultValue: '0' },
  { value: 'counter', label: 'Counter', staticVariation: 'Group20Var1', eventVariation: 'Group22Var1', defaultValue: '0' },
  { value: 'frozen_counter', label: 'Frozen Counter', staticVariation: 'Group21Var1', eventVariation: 'Group23Var1', defaultValue: '0' },
  { value: 'binary_output_status', label: 'Binary Output Status', staticVariation: 'Group10Var2', eventVariation: 'Group11Var2', defaultValue: 'false' },
  { value: 'analog_output_status', label: 'Analog Output Status', staticVariation: 'Group40Var1', eventVariation: 'Group42Var1', defaultValue: '0' },
]

const POINT_CLASSES = ['class0', 'class1', 'class2', 'class3']

function StatCell({ label, value }) {
  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, px: 1.25, py: 1, minHeight: 64 }}>
      <Typography variant="caption" sx={{ color: '#6b7280', display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5, overflowWrap: 'anywhere' }}>{value}</Typography>
    </Box>
  )
}

export default function OutstationsPanel() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [config, setConfig] = useState({
    port: 20000,
    master_address: 1,
    outstation_address: 2,
  })
  const [pointForm, setPointForm] = useState({
    type: 'binary',
    index: 1,
    name: 'Binary Input 1',
    value: 'false',
    point_class: 'class1',
    static_variation: 'Group1Var2',
    event_variation: 'Group2Var2',
    deadband: 0,
    flags: 1,
  })

  const outstation = status?.outstation || status?.demo_outstation || status
  const isRunning = Boolean(outstation?.running)
  const isCompiled = Boolean(outstation?.compiled)
  const points = outstation?.points || []

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await api.getDemoOutstationStatus()
      setStatus(data)
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.detail || err.message || 'Failed to reach demo outstation runtime.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const runAction = async (action) => {
    setLoading(true)
    setMessage(null)
    try {
      const payload = {
        port: Number(config.port),
        master_address: Number(config.master_address),
        outstation_address: Number(config.outstation_address),
      }
      const data = action === 'start'
        ? await api.startDemoOutstation(payload)
        : action === 'update'
          ? await api.updateDemoOutstation()
          : await api.stopDemoOutstation()
      setStatus(data)
      setMessage({ severity: data.ok ? 'success' : 'warning', text: data.detail || 'Command completed.' })
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.detail || err.message || 'Command failed.' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfigChange = (field) => (event) => {
    setConfig(prev => ({ ...prev, [field]: event.target.value }))
  }

  const refreshFromResult = (data, fallbackText) => {
    setStatus(data)
    setMessage({ severity: data.ok ? 'success' : 'warning', text: data.detail || fallbackText })
  }

  const handlePointFormChange = (field) => (event) => {
    const value = event.target.value
    setPointForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'type') {
        const type = POINT_TYPES.find(item => item.value === value)
        next.static_variation = type?.staticVariation || ''
        next.event_variation = type?.eventVariation || ''
        next.value = type?.defaultValue || ''
        next.name = `${type?.label || 'Point'} ${prev.index}`
      }
      if (field === 'index') {
        const type = POINT_TYPES.find(item => item.value === prev.type)
        next.name = `${type?.label || 'Point'} ${value}`
      }
      return next
    })
  }

  const addPoint = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const payload = {
        ...pointForm,
        index: Number(pointForm.index),
        deadband: Number(pointForm.deadband),
        flags: Number(pointForm.flags),
      }
      refreshFromResult(await api.addDemoOutstationPoint(payload), 'Point added.')
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.detail || err.message || 'Failed to add point.' })
    } finally {
      setLoading(false)
    }
  }

  const updatePointValue = async (point) => {
    setLoading(true)
    setMessage(null)
    try {
      refreshFromResult(await api.updateDemoOutstationPoint(point.id, { value: point.value, flags: Number(point.flags) }), 'Point updated.')
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.detail || err.message || 'Failed to update point.' })
    } finally {
      setLoading(false)
    }
  }

  const deletePoint = async (point) => {
    setLoading(true)
    setMessage(null)
    try {
      refreshFromResult(await api.deleteDemoOutstationPoint(point.id), 'Point deleted.')
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.detail || err.message || 'Failed to delete point.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc' }}>
      <Box sx={{ px: 2, py: 1.5, bgcolor: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 1 }}>
        <DnsIcon color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Demo Outstation</Typography>
          <Typography variant="caption" sx={{ color: '#6b7280' }}>OpenDNP3 TCP outstation for validating one or more masters</Typography>
        </Box>
        <Chip
          size="small"
          label={isRunning ? 'Running' : 'Stopped'}
          color={isRunning ? 'success' : 'default'}
          variant={isRunning ? 'filled' : 'outlined'}
        />
        <Chip
          size="small"
          label={isCompiled ? 'OpenDNP3' : 'Scaffold'}
          color={isCompiled ? 'primary' : 'warning'}
          variant="outlined"
        />
      </Box>

      <Box sx={{ p: 2, overflow: 'auto' }}>
        <Stack spacing={2}>
          {message && <Alert severity={message.severity}>{message.text}</Alert>}

          <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 1 }}>
            <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Runtime Controls</Typography>
              {loading && <CircularProgress size={18} />}
            </Box>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="TCP Port"
                    type="number"
                    size="small"
                    value={config.port}
                    onChange={handleConfigChange('port')}
                    fullWidth
                    disabled={isRunning || loading}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Master Address"
                    type="number"
                    size="small"
                    value={config.master_address}
                    onChange={handleConfigChange('master_address')}
                    fullWidth
                    disabled={isRunning || loading}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Outstation Address"
                    type="number"
                    size="small"
                    value={config.outstation_address}
                    onChange={handleConfigChange('outstation_address')}
                    fullWidth
                    disabled={isRunning || loading}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => runAction('start')}
                  disabled={loading || isRunning}
                >
                  Start
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AutorenewIcon />}
                  onClick={() => runAction('update')}
                  disabled={loading || !isRunning}
                >
                  Update Values
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={() => runAction('stop')}
                  disabled={loading || !isRunning}
                >
                  Stop
                </Button>
                <Button
                  variant="text"
                  startIcon={<RefreshIcon />}
                  onClick={loadStatus}
                  disabled={loading}
                >
                  Status
                </Button>
              </Stack>
            </Box>
          </Box>

          <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 1 }}>
            <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>DNP3 Points</Typography>
              <Chip size="small" variant="outlined" label={`${points.length} points`} />
            </Box>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField select label="Type" size="small" fullWidth value={pointForm.type} onChange={handlePointFormChange('type')} disabled={isRunning || loading}>
                    {POINT_TYPES.map(type => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={3} md={1}>
                  <TextField label="Index" type="number" size="small" fullWidth value={pointForm.index} onChange={handlePointFormChange('index')} disabled={isRunning || loading} />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField label="Name" size="small" fullWidth value={pointForm.name} onChange={handlePointFormChange('name')} disabled={isRunning || loading} />
                </Grid>
                <Grid item xs={6} sm={3} md={1.5}>
                  <TextField label="Value" size="small" fullWidth value={pointForm.value} onChange={handlePointFormChange('value')} disabled={loading} />
                </Grid>
                <Grid item xs={6} sm={3} md={1.25}>
                  <TextField select label="Class" size="small" fullWidth value={pointForm.point_class} onChange={handlePointFormChange('point_class')} disabled={isRunning || loading}>
                    {POINT_CLASSES.map(clazz => <MenuItem key={clazz} value={clazz}>{clazz}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={3} md={1.5}>
                  <TextField label="Static Var" size="small" fullWidth value={pointForm.static_variation} onChange={handlePointFormChange('static_variation')} disabled={isRunning || loading} />
                </Grid>
                <Grid item xs={6} sm={3} md={1.5}>
                  <TextField label="Event Var" size="small" fullWidth value={pointForm.event_variation} onChange={handlePointFormChange('event_variation')} disabled={isRunning || loading} />
                </Grid>
                <Grid item xs={6} sm={3} md={1}>
                  <TextField label="Flags" type="number" size="small" fullWidth value={pointForm.flags} onChange={handlePointFormChange('flags')} disabled={loading} />
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={addPoint} disabled={loading || isRunning}>Add Point</Button>
                {isRunning && <Typography variant="caption" sx={{ color: '#6b7280', alignSelf: 'center' }}>Stop the outstation to add or remove database points.</Typography>}
              </Stack>
            </Box>
            <Divider />
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Index</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Static</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Flags</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {points.map(point => (
                    <TableRow key={point.id}>
                      <TableCell>{POINT_TYPES.find(item => item.value === point.type)?.label || point.type}</TableCell>
                      <TableCell>{point.index}</TableCell>
                      <TableCell>{point.name}</TableCell>
                      <TableCell>{point.point_class}</TableCell>
                      <TableCell>{point.static_variation || '-'}</TableCell>
                      <TableCell>{point.event_variation || '-'}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={point.value}
                          onChange={(event) => {
                            const nextPoints = points.map(item => item.id === point.id ? { ...item, value: event.target.value } : item)
                            setStatus(prev => ({ ...prev, outstation: { ...outstation, points: nextPoints } }))
                          }}
                          sx={{ width: 120 }}
                        />
                      </TableCell>
                      <TableCell>{point.flags}</TableCell>
                      <TableCell align="right">
                        <Button size="small" startIcon={<SaveIcon />} onClick={() => updatePointValue(point)} disabled={loading}>Save</Button>
                        <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => deletePoint(point)} disabled={loading || isRunning}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {points.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ color: '#9ca3af' }}>No points configured.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Box>

          <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 1 }}>
            <Box sx={{ px: 1.5, py: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Measurements</Typography>
            </Box>
            <Divider />
            <Grid container spacing={1.5} sx={{ p: 1.5 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCell label="Binary Input 0" value={String(Boolean(outstation?.binary))} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCell label="Analog Input 0" value={outstation?.analog ?? '-'} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCell label="Counter 0" value={outstation?.counter ?? '-'} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCell label="Last Error" value={outstation?.last_error || 'None'} />
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
