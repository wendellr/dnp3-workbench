import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const http = axios.create({ baseURL: BASE_URL })

export const api = {
  // Server capabilities
  getCapabilities: () => http.get('/capabilities').then(r => r.data),

  // Masters
  getMasters: () => http.get('/masters').then(r => r.data),
  getMaster: (id) => http.get(`/masters/${id}`).then(r => r.data),
  createMaster: (data) => http.post('/masters', data).then(r => r.data),
  deleteMaster: (id) => http.delete(`/masters/${id}`).then(r => r.data),
  updateMasterConfig: (id, data) => http.put(`/masters/${id}/config`, data).then(r => r.data),
  connectMaster: (id) => http.post(`/masters/${id}/connect`).then(r => r.data),
  disconnectMaster: (id) => http.post(`/masters/${id}/disconnect`).then(r => r.data),
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
