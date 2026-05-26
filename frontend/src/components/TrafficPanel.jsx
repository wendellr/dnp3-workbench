import React from 'react'
import {
  Box, Chip, Divider, LinearProgress, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography
} from '@mui/material'

const stateColors = {
  disconnected: 'default',
  connecting: 'warning',
  connected: 'success',
  error: 'error',
}

export default function TrafficPanel({ masters }) {
  const total = masters.length
  const connected = masters.filter(master => master.state === 'connected').length
  const error = masters.filter(master => master.state === 'error').length
  const activeRatio = total ? Math.round((connected / total) * 100) : 0

  return (
    <Box sx={{ height: '100%', overflow: 'auto', bgcolor: '#f8fafc', p: 2 }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>Traffic</Typography>
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              Runtime event overview across configured Masters
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Chip label="Runtime events" size="small" color="primary" variant="outlined" />
          <Chip label="Raw frames pending" size="small" color="warning" variant="outlined" />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>Masters</Typography>
            <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700 }}>{total}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>Connected</Typography>
            <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, color: '#166534' }}>{connected}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontWeight: 600 }}>Error</Typography>
            <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, color: '#991b1b' }}>{error}</Typography>
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Active Channels</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" sx={{ color: '#6b7280' }}>{activeRatio}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={activeRatio} sx={{ height: 8, borderRadius: 1 }} />
        </Paper>

        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f3f4f6' }}>
                <TableCell>Name</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Transport</TableCell>
                <TableCell>Endpoint</TableCell>
                <TableCell>Addresses</TableCell>
                <TableCell>Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {masters.map(master => (
                <TableRow key={master.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{master.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={master.state}
                      size="small"
                      color={stateColors[master.state] || 'default'}
                      variant={master.state === 'connected' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>{String(master.comm_mode || '').toUpperCase()}</TableCell>
                  <TableCell>
                    {(master.tcp_config?.ip_address || '127.0.0.1')}:{master.tcp_config?.port || 20000}
                  </TableCell>
                  <TableCell>MA {master.master_address} / OA {master.outstation_address}</TableCell>
                  <TableCell>{master.data_points?.length || 0}</TableCell>
                </TableRow>
              ))}
              {masters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center', color: '#9ca3af' }}>
                    No Masters configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" sx={{ color: '#6b7280' }}>
          Per-Master Traffic and Log tabs contain the live WebSocket streams currently available.
        </Typography>
      </Box>
    </Box>
  )
}

