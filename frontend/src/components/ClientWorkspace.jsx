import React, { useState } from 'react'
import { Box, Tabs, Tab, Button, ButtonGroup, Chip } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import CommConfigTab from './tabs/CommConfigTab'
import PollingConfigTab from './tabs/PollingConfigTab'
import DataPointsTab from './tabs/DataPointsTab'
import StationCommandsTab from './tabs/StationCommandsTab'
import PointCommandsTab from './tabs/PointCommandsTab'
import TrafficMonitorTab from './tabs/TrafficMonitorTab'
import LogViewerTab from './tabs/LogViewerTab'
import { api } from '../services/api'

const stateLabels = {
  disconnected: { label: 'Disconnected', color: 'default' },
  connecting: { label: 'Connecting...', color: 'warning' },
  connected: { label: 'Connected', color: 'success' },
  error: { label: 'Error', color: 'error' },
}

export default function ClientWorkspace({ client, onClientUpdated, onRefresh }) {
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(false)

  const isConnected = client.state === 'connected'
  const stateInfo = stateLabels[client.state] || stateLabels.disconnected

  const handleConnect = async () => {
    setLoading(true)
    try {
      await api.connectMaster(client.id)
      onRefresh()
    } catch (err) {
      console.error('Connect failed:', err)
    }
    setLoading(false)
  }

  const handleDisconnect = async () => {
    setLoading(true)
    try {
      await api.disconnectMaster(client.id)
      onRefresh()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
    setLoading(false)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header with connection controls */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, p: 1,
        bgcolor: '#fff', borderBottom: '1px solid #ddd', borderRadius: 1, mb: 1,
      }}>
        <Box sx={{ fontWeight: 600, fontSize: 14, mr: 1 }}>{client.name}</Box>
        <Chip
          label={stateInfo.label}
          color={stateInfo.color}
          size="small"
          variant="outlined"
        />
        <Box sx={{ flex: 1 }} />
        <ButtonGroup size="small" variant="contained">
          <Button
            startIcon={<PlayArrowIcon />}
            onClick={handleConnect}
            disabled={isConnected || loading}
            color="success"
          >
            Connect
          </Button>
          <Button
            startIcon={<StopIcon />}
            onClick={handleDisconnect}
            disabled={!isConnected || loading}
            color="error"
          >
            Disconnect
          </Button>
        </ButtonGroup>
      </Box>

      {/* Tabs */}
      <Box sx={{ bgcolor: '#fff', borderRadius: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: '1px solid #ddd', minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, fontSize: 12 } }}
        >
          <Tab label="Connection" />
          <Tab label="Polling" />
          <Tab label="Data Points" />
          <Tab label="Station Commands" disabled={!isConnected} />
          <Tab label="Point Commands" disabled={!isConnected} />
          <Tab label="Traffic" />
          <Tab label="Log" />
        </Tabs>

        <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
          {tab === 0 && <CommConfigTab client={client} onUpdated={onClientUpdated} />}
          {tab === 1 && <PollingConfigTab client={client} onUpdated={onClientUpdated} />}
          {tab === 2 && <DataPointsTab client={client} />}
          {tab === 3 && <StationCommandsTab client={client} />}
          {tab === 4 && <PointCommandsTab client={client} />}
          {tab === 5 && <TrafficMonitorTab client={client} />}
          {tab === 6 && <LogViewerTab client={client} />}
        </Box>
      </Box>
    </Box>
  )
}
