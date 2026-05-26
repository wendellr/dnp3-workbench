import React, { useState, useEffect, useCallback } from 'react'
import { Box, AppBar, Toolbar, Typography, Chip, Tooltip, IconButton } from '@mui/material'
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna'
import HubIcon from '@mui/icons-material/Hub'
import DnsIcon from '@mui/icons-material/Dns'
import RouteIcon from '@mui/icons-material/Route'
import SettingsIcon from '@mui/icons-material/Settings'
import ClientListPanel from './components/ClientListPanel'
import ClientWorkspace from './components/ClientWorkspace'
import OutstationsPanel from './components/OutstationsPanel'
import { api } from './services/api'

export default function App() {
  const [masters, setMasters] = useState([])
  const [selectedMasterId, setSelectedMasterId] = useState(null)
  const [activeModule, setActiveModule] = useState('masters')
  const [capabilities, setCapabilities] = useState(null)

  const fetchMasters = useCallback(async () => {
    try {
      const data = await api.getMasters()
      setMasters(data)
    } catch (err) {
      console.error('Failed to fetch masters:', err)
    }
  }, [])

  const fetchCapabilities = useCallback(async () => {
    try {
      const data = await api.getCapabilities()
      setCapabilities(data)
    } catch (err) {
      console.error('Failed to fetch server capabilities:', err)
      setCapabilities({
        app_env: 'unknown',
        dnp3_engine: 'unknown',
        modules: { masters: true, outstations: false, traffic: false, settings: false },
      })
    }
  }, [])

  useEffect(() => { fetchCapabilities() }, [fetchCapabilities])

  useEffect(() => { fetchMasters() }, [fetchMasters])

  useEffect(() => {
    const refreshTimer = setInterval(fetchMasters, 2000)
    return () => clearInterval(refreshTimer)
  }, [fetchMasters])

  useEffect(() => {
    if (capabilities?.modules && activeModule !== 'masters' && !capabilities.modules[activeModule]) {
      setActiveModule('masters')
    }
  }, [activeModule, capabilities])

  const selectedMaster = masters.find(c => c.id === selectedMasterId)

  const handleAddMaster = async () => {
    const count = masters.length + 1
    const master = await api.createMaster({ name: `Master ${count}` })
    setMasters(prev => [...prev, master])
    setSelectedMasterId(master.id)
  }

  const handleDeleteMaster = async (id) => {
    await api.deleteMaster(id)
    setMasters(prev => prev.filter(c => c.id !== id))
    if (selectedMasterId === id) {
      setSelectedMasterId(null)
    }
  }

  const handleMasterUpdated = (updatedMaster) => {
    setMasters(prev => prev.map(c => c.id === updatedMaster.id ? updatedMaster : c))
  }

  const moduleFlags = capabilities?.modules || {}
  const modules = [
    { id: 'masters', label: 'Masters', icon: <HubIcon fontSize="small" />, disabled: false },
    { id: 'outstations', label: 'Outstations', icon: <DnsIcon fontSize="small" />, disabled: !moduleFlags.outstations, restricted: capabilities && !moduleFlags.outstations },
    { id: 'traffic', label: 'Traffic', icon: <RouteIcon fontSize="small" />, disabled: !moduleFlags.traffic },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon fontSize="small" />, disabled: !moduleFlags.settings },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Bar */}
      <AppBar position="static" sx={{ bgcolor: '#1a237e' }}>
        <Toolbar variant="dense">
          <SettingsInputAntennaIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: 16 }}>
            DNP3 Master/Outstation Workbench
          </Typography>
          <Chip label="v1.0.0" size="small" sx={{ color: '#fff', borderColor: '#fff' }} variant="outlined" />
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ width: 56, bgcolor: '#111827', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, gap: 0.5 }}>
          {modules.map(module => (
            <Tooltip title={module.restricted ? `${module.label} (restricted)` : module.disabled ? `${module.label} (planned)` : module.label} placement="right" key={module.id}>
              <span>
                <IconButton
                  size="small"
                  disabled={module.disabled}
                  onClick={() => setActiveModule(module.id)}
                  sx={{
                    color: activeModule === module.id ? '#fff' : '#9ca3af',
                    bgcolor: activeModule === module.id ? '#2563eb' : 'transparent',
                    '&:hover': { bgcolor: module.disabled ? 'transparent' : '#1d4ed8' },
                    '&.Mui-disabled': { color: '#4b5563' },
                  }}
                >
                  {module.icon}
                </IconButton>
              </span>
            </Tooltip>
          ))}
        </Box>

        {activeModule === 'masters' && (
          <ClientListPanel
            clients={masters}
            selectedClientId={selectedMasterId}
            onSelect={setSelectedMasterId}
            onAdd={handleAddMaster}
            onDelete={handleDeleteMaster}
          />
        )}

        {/* Right Panel - Client Workspace */}
        <Box sx={{ flex: 1, overflow: 'auto', p: activeModule === 'masters' ? 1 : 0 }}>
          {activeModule === 'masters' ? (
            selectedMaster ? (
              <ClientWorkspace
                client={selectedMaster}
                onClientUpdated={handleMasterUpdated}
                onRefresh={fetchMasters}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
                <Typography>Select or add a master to begin</Typography>
              </Box>
            )
          ) : activeModule === 'outstations' ? (
            <OutstationsPanel />
          ) : null}
        </Box>
      </Box>

      {/* Status Bar */}
      <Box sx={{ bgcolor: '#263238', color: '#ccc', px: 2, py: 0.5, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
        <span>DNP3 IEEE 1815 Master/Outstation Workbench - Web Edition</span>
        <span>{capabilities?.app_env || 'development'} · DNP3_ENGINE={capabilities?.dnp3_engine || 'loading'}</span>
      </Box>
    </Box>
  )
}
