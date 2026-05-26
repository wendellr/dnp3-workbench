import React from 'react'
import {
  Box, Chip, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography
} from '@mui/material'

function CapabilityChip({ enabled }) {
  return (
    <Chip
      label={enabled ? 'Enabled' : 'Disabled'}
      size="small"
      color={enabled ? 'success' : 'default'}
      variant={enabled ? 'filled' : 'outlined'}
    />
  )
}

export default function SettingsPanel({ capabilities }) {
  const modules = capabilities?.modules || {}
  const rows = [
    ['Environment', capabilities?.app_env || 'loading'],
    ['DNP3 engine', capabilities?.dnp3_engine || 'loading'],
    ['Max Masters', capabilities?.max_masters ?? '-'],
    ['Demo Outstation', capabilities?.demo_outstation_available ? 'available' : 'restricted'],
    ['Public Outstation Management', capabilities?.public_outstation_management ? 'enabled' : 'restricted'],
  ]

  return (
    <Box sx={{ height: '100%', overflow: 'auto', bgcolor: '#f8fafc', p: 2 }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>Settings</Typography>
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              Server capabilities and deployment posture
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Chip label={capabilities?.app_env || 'loading'} size="small" color="primary" variant="outlined" />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f3f4f6' }}>
                  <TableCell>Setting</TableCell>
                  <TableCell>Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell sx={{ fontWeight: 600 }}>{label}</TableCell>
                    <TableCell>{value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f3f4f6' }}>
                  <TableCell>Module</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {['masters', 'outstations', 'traffic', 'settings'].map(module => (
                  <TableRow key={module}>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{module}</TableCell>
                    <TableCell><CapabilityChip enabled={Boolean(modules[module])} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Production Flags</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label={`ENABLE_DEMO_OUTSTATION=${capabilities?.demo_outstation_available ? 'true' : 'false'}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`ENABLE_PUBLIC_OUTSTATION_MANAGEMENT=${capabilities?.public_outstation_management ? 'true' : 'false'}`}
              size="small"
              color={capabilities?.public_outstation_management ? 'warning' : 'success'}
              variant="outlined"
            />
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
