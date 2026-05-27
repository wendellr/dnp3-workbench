import React, { useState, useEffect } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel,
  Snackbar, Alert
} from '@mui/material'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import RefreshIcon from '@mui/icons-material/Refresh'
import { api } from '../../services/api'

const groupNames = {
  1: 'Binary Input', 3: 'Double-bit BI', 10: 'Binary Output',
  20: 'Counter', 21: 'Frozen Counter', 30: 'Analog Input',
  31: 'Frozen AI', 40: 'Analog Output', 110: 'Octet String',
}

const qualityColors = {
  ONLINE: 'success', RESTART: 'warning', COMM_LOST: 'error',
  REMOTE_FORCED: 'info', LOCAL_FORCED: 'info', OVER_RANGE: 'warning',
  REFERENCE_ERR: 'error', CHATTER_FILTER: 'warning',
}

export default function DataPointsTab({ client }) {
  const [dataPoints, setDataPoints] = useState(client.data_points || [])
  const [groupFilter, setGroupFilter] = useState('all')
  const [toast, setToast] = useState(null)
  const [clearing, setClearing] = useState(false)

  const fetchData = async () => {
    try {
      const data = await api.getMasterDataPoints(client.id)
      setDataPoints(data)
    } catch (err) {
      console.error('Failed to fetch data points:', err)
    }
  }

  useEffect(() => { fetchData() }, [client.id])

  const clearDataPoints = async () => {
    if (!window.confirm('Clear all collected data points for this master?')) return
    setClearing(true)
    try {
      await api.clearMasterDataPoints(client.id)
      setDataPoints([])
      setToast({ severity: 'success', message: 'Collected data points cleared.' })
    } catch (err) {
      console.error('Failed to clear data points:', err)
      setToast({
        severity: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to clear data points.',
      })
    } finally {
      setClearing(false)
    }
  }

  const filtered = groupFilter === 'all'
    ? dataPoints
    : dataPoints.filter(dp => dp.group === parseInt(groupFilter))

  const uniqueGroups = [...new Set(dataPoints.map(dp => dp.group))].sort((a, b) => a - b)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Data Points</Typography>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Filter Group</InputLabel>
          <Select value={groupFilter} label="Filter Group" onChange={e => setGroupFilter(e.target.value)}>
            <MenuItem value="all">All Groups</MenuItem>
            {uniqueGroups.map(g => (
              <MenuItem key={g} value={g}>{g} - {groupNames[g] || `Group ${g}`}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Chip label={`${filtered.length} points`} size="small" />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={fetchData}><RefreshIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Clear collected data points">
          <span>
            <IconButton size="small" color="error" disabled={clearing || dataPoints.length === 0} onClick={clearDataPoints}>
              <DeleteSweepIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Index</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Source Type</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Group</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Variation</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Value</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Quality</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>Timestamp</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 11 }}>DNP Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((dp, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontSize: 12 }}>{dp.index}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{dp.source_type || '-'}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{dp.group} - {groupNames[dp.group] || ''}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{dp.variation}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{dp.description}</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{dp.value}</TableCell>
                <TableCell>
                  <Chip label={dp.quality} size="small"
                    color={qualityColors[dp.quality] || 'default'}
                    sx={{ fontSize: 10, height: 20 }} />
                </TableCell>
                <TableCell sx={{ fontSize: 11, color: '#666' }}>{dp.timestamp}</TableCell>
                <TableCell sx={{ fontSize: 11, color: '#666' }}>{dp.dnp_time || '-'}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center', py: 3, color: '#999' }}>
                  No data points. Execute an Integrity Poll to fetch data.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
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
