import React from 'react'
import {
  Box, List, ListItemButton, ListItemText, ListItemIcon,
  IconButton, Typography, Divider, Tooltip
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ComputerIcon from '@mui/icons-material/Computer'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import LinkedInIcon from '@mui/icons-material/LinkedIn'

const stateColors = {
  disconnected: '#bdbdbd',
  connecting: '#ff9800',
  connected: '#4caf50',
  error: '#f44336',
}

export default function ClientListPanel({ clients, selectedClientId, onSelect, onAdd, onDelete }) {
  return (
    <Box sx={{
      width: 240, minWidth: 240, bgcolor: '#fff', borderRight: '1px solid #ddd',
      display: 'flex', flexDirection: 'column',
    }}>
      <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#e3f2fd' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Masters</Typography>
        <Tooltip title="Add Master">
          <IconButton size="small" onClick={onAdd} color="primary">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
      <List dense sx={{ flex: 1, overflow: 'auto', py: 0 }}>
        {clients.map(client => (
          <ListItemButton
            key={client.id}
            selected={client.id === selectedClientId}
            onClick={() => onSelect(client.id)}
            sx={{ py: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <ComputerIcon fontSize="small" color="action" />
            </ListItemIcon>
            <ListItemText
              primary={client.name}
              secondary={(
                <Box component="span" sx={{ display: 'block', lineHeight: 1.25 }}>
                  <Box component="span" sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {client.comm_mode.toUpperCase()} {client.tcp_config?.ip_address || '127.0.0.1'}:{client.tcp_config?.port || 20000}
                  </Box>
                  <Box component="span" sx={{ display: 'block', color: '#6b7280' }}>
                    Master {client.master_address} / Outstation {client.outstation_address}
                  </Box>
                </Box>
              )}
              primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
              secondaryTypographyProps={{ component: 'div', fontSize: 11 }}
            />
            <FiberManualRecordIcon
              sx={{ fontSize: 10, color: stateColors[client.state] || '#bdbdbd', mr: 0.5 }}
            />
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDelete(client.id) }}
              sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </ListItemButton>
        ))}
        {clients.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center', color: '#999' }}>
            <Typography variant="body2">No masters. Click + to add.</Typography>
          </Box>
        )}
      </List>
      <Divider />
      <Box sx={{ p: 1.25, textAlign: 'center', color: '#6b7280' }}>
        <Typography sx={{ mb: 1, fontSize: 10.5, color: '#9ca3af', fontWeight: 500 }}>
          {clients.length}/50 masters
        </Typography>
        <Typography sx={{ fontSize: 10.5, lineHeight: 1.45, fontWeight: 600, color: '#4b5563' }}>
          Developed by Prof. Wendell Rodrigues, Ph.D.
        </Typography>
        <Typography sx={{ mt: 0.25, fontSize: 10, lineHeight: 1.35, color: '#6b7280' }}>
          In collaboration with OpenAI Codex
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 9.5, lineHeight: 1.35, color: '#9ca3af' }}>
          Inspired by FreyrSCADA.com · Built with PyDNP3
        </Typography>
        <Box sx={{ mt: 0.75, display: 'flex', justifyContent: 'center' }}>
          <Tooltip title="LinkedIn - Wendell Rodrigues">
            <IconButton
              component="a"
              href="https://www.linkedin.com/in/wendelloliveirarodrigues/"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn - Wendell Rodrigues"
              size="small"
              sx={{ color: '#0a66c2', p: 0.25 }}
            >
              <LinkedInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  )
}
