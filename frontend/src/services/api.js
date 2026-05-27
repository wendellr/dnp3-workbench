import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const LOCAL_MASTERS_KEY = 'dnp3.workbench.localMasters.v1'

const http = axios.create({ baseURL: BASE_URL })

const defaultMaster = (data = {}) => ({
  id: data.id || crypto.randomUUID(),
  name: data.name || 'New Master',
  comm_mode: data.comm_mode || 'tcp',
  master_address: data.master_address ?? 1,
  outstation_address: data.outstation_address ?? 2,
  state: data.state || 'disconnected',
  serial_config: {
    port: 'COM1',
    baud_rate: 9600,
    data_bits: 8,
    parity: 'none',
    stop_bits: 1,
    flow_control: 'none',
    ...(data.serial_config || {}),
  },
  tcp_config: {
    ip_address: '127.0.0.1',
    port: 20000,
    ...(data.tcp_config || {}),
  },
  udp_config: {
    ip_address: '127.0.0.1',
    port: 20000,
    ...(data.udp_config || {}),
  },
  polling_config: {
    integrity_poll_interval: 30,
    class1_poll_interval: 5,
    class2_poll_interval: 10,
    class3_poll_interval: 15,
    enable_unsolicited: true,
    ...(data.polling_config || {}),
  },
  timeout_config: {
    link_layer_timeout: 5000,
    application_layer_timeout: 10000,
    command_timeout: 5000,
    ...(data.timeout_config || {}),
  },
  data_points: data.data_points || [],
})

const persistedMaster = (master) => {
  const { data_points, state, ...config } = master
  return config
}

const readLocalMasters = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_MASTERS_KEY) || '[]').map(defaultMaster)
  } catch {
    return []
  }
}

const writeLocalMasters = (masters) => {
  localStorage.setItem(LOCAL_MASTERS_KEY, JSON.stringify(masters.map(master => persistedMaster(defaultMaster(master)))))
}

const updateLocalMaster = (id, updater) => {
  const masters = readLocalMasters()
  const next = masters.map(master => master.id === id ? defaultMaster(updater(master)) : master)
  writeLocalMasters(next)
  return next.find(master => master.id === id) || null
}

const mergeRuntimeState = async (master) => {
  try {
    const runtime = await http.get(`/masters/${master.id}`).then(r => r.data)
    return defaultMaster({ ...master, state: runtime.state, data_points: runtime.data_points || [] })
  } catch {
    return defaultMaster({ ...master, state: 'disconnected', data_points: [] })
  }
}

const ensureRuntimeMaster = async (master) => {
  const payload = persistedMaster(defaultMaster(master))
  try {
    await http.get(`/masters/${master.id}`)
    return http.put(`/masters/${master.id}/config`, payload).then(r => r.data)
  } catch {
    return http.post('/masters', payload).then(r => r.data)
  }
}

export const api = {
  // Server capabilities
  getCapabilities: () => http.get('/capabilities').then(r => r.data),

  // Masters
  getMasters: async () => Promise.all(readLocalMasters().map(mergeRuntimeState)),
  getMaster: async (id) => {
    const master = readLocalMasters().find(item => item.id === id)
    if (!master) throw new Error('Master not found in local browser storage.')
    return mergeRuntimeState(master)
  },
  createMaster: async (data) => {
    const master = defaultMaster(data)
    writeLocalMasters([...readLocalMasters(), master])
    return master
  },
  deleteMaster: async (id) => {
    writeLocalMasters(readLocalMasters().filter(master => master.id !== id))
    try {
      await http.delete(`/masters/${id}`)
    } catch {
      // Runtime sessions are temporary; absence on the server is acceptable.
    }
    return { status: 'deleted' }
  },
  updateMasterConfig: async (id, data) => {
    const updated = updateLocalMaster(id, master => ({ ...master, ...data }))
    if (!updated) throw new Error('Master not found in local browser storage.')
    try {
      await ensureRuntimeMaster(updated)
    } catch {
      // Saving local configuration should not require a live backend session.
    }
    return updated
  },
  connectMaster: async (id) => {
    const master = readLocalMasters().find(item => item.id === id)
    if (!master) throw new Error('Master not found in local browser storage.')
    await ensureRuntimeMaster(master)
    const result = await http.post(`/masters/${id}/connect`).then(r => r.data)
    updateLocalMaster(id, item => ({ ...item, state: 'connected' }))
    return result
  },
  disconnectMaster: async (id) => {
    const result = await http.post(`/masters/${id}/disconnect`).then(r => r.data)
    updateLocalMaster(id, item => ({ ...item, state: 'disconnected' }))
    return result
  },
  masterStationCommand: (id, command) => http.post(`/masters/${id}/commands/station`, { command }).then(r => r.data),
  masterPointCommand: (id, data) => http.post(`/masters/${id}/commands/point`, data).then(r => r.data),
  getMasterDataPoints: (id) => http.get(`/masters/${id}/datapoints`).then(r => r.data),
  clearMasterDataPoints: (id) => http.delete(`/masters/${id}/datapoints`).then(r => r.data),

  // Clients
  getClients: () => http.get('/clients').then(r => r.data),
  getClient: (id) => http.get(`/clients/${id}`).then(r => r.data),
  createClient: (data) => http.post('/clients', data).then(r => r.data),
  deleteClient: (id) => http.delete(`/clients/${id}`).then(r => r.data),
  updateClientConfig: (id, data) => http.put(`/clients/${id}/config`, data).then(r => r.data),

  // Connection
  connectClient: (id) => http.post(`/clients/${id}/connect`).then(r => r.data),
  disconnectClient: (id) => http.post(`/clients/${id}/disconnect`).then(r => r.data),

  // Commands
  stationCommand: (id, command) => http.post(`/clients/${id}/commands/station`, { command }).then(r => r.data),
  pointCommand: (id, data) => http.post(`/clients/${id}/commands/point`, data).then(r => r.data),

  // Data
  getDataPoints: (id) => http.get(`/clients/${id}/datapoints`).then(r => r.data),

  // Reference
  getDnp3Groups: () => http.get('/dnp3/groups').then(r => r.data),

  // Demo Outstation
  getDemoOutstationStatus: () => http.get('/demo-outstation/status').then(r => r.data),
  startDemoOutstation: (data = {}) => http.post('/demo-outstation/start', data).then(r => r.data),
  updateDemoOutstation: () => http.post('/demo-outstation/update').then(r => r.data),
  stopDemoOutstation: () => http.post('/demo-outstation/stop').then(r => r.data),
  getDemoOutstationPoints: () => http.get('/demo-outstation/points').then(r => r.data),
  addDemoOutstationPoint: (data) => http.post('/demo-outstation/points', data).then(r => r.data),
  updateDemoOutstationPoint: (id, data) => http.put(`/demo-outstation/points/${encodeURIComponent(id)}`, data).then(r => r.data),
  deleteDemoOutstationPoint: (id) => http.delete(`/demo-outstation/points/${encodeURIComponent(id)}`).then(r => r.data),
}

export function createWebSocket(clientId, type) {
  const wsBase = window.location.origin.replace(/^http/, 'ws')
  return new WebSocket(`${wsBase}/api/clients/${clientId}/${type}`)
}

export function createMasterWebSocket(masterId, type) {
  const wsBase = window.location.origin.replace(/^http/, 'ws')
  return new WebSocket(`${wsBase}/api/masters/${masterId}/${type}`)
}
