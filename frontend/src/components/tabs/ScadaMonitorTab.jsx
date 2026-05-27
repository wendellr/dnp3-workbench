import React, { useEffect, useMemo, useState } from 'react'
import {
  Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Paper,
  Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import { api, createMasterWebSocket } from '../../services/api'

const groupNames = {
  1: 'Binary Input',
  3: 'Double-bit BI',
  10: 'Binary Output',
  20: 'Counter',
  21: 'Frozen Counter',
  30: 'Analog Input',
  40: 'Analog Output',
}

const pointKey = (point) => `${point.group}:${point.variation}:${point.index}:${point.source_type || ''}`

const formatPointLabel = (point) => (
  point.alias || `${point.source_type || groupNames[point.group] || 'Point'} ${point.index}`
)

const valueColor = (point) => {
  if ([1, 3, 10].includes(point.group)) {
    return String(point.value).toLowerCase() === 'true' || String(point.value) === '1' ? '#166534' : '#991b1b'
  }
  if ([20, 21].includes(point.group)) return '#7c2d12'
  if ([30, 40].includes(point.group)) return '#1d4ed8'
  return '#111827'
}

export default function ScadaMonitorTab({ client }) {
  const storageKey = `dnp3.scada.points.${client.id}`
  const [points, setPoints] = useState(client.data_points || [])
  const [selectedKeys, setSelectedKeys] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]')
    } catch {
      return []
    }
  })
  const [groupFilter, setGroupFilter] = useState('all')
  const [search, setSearch] = useState('')

  const fetchPoints = async () => {
    try {
      setPoints(await api.getMasterDataPoints(client.id))
    } catch (err) {
      console.error('Failed to fetch SCADA monitor points:', err)
    }
  }

  useEffect(() => { fetchPoints() }, [client.id])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(selectedKeys))
  }, [selectedKeys, storageKey])

  useEffect(() => {
    const ws = createMasterWebSocket(client.id, 'data')
    ws.onmessage = (event) => {
      const nextPoints = JSON.parse(event.data)
      setPoints(nextPoints)
    }
    return () => ws.close()
  }, [client.id])

  const pointByKey = useMemo(() => {
    const map = new Map()
    points.forEach(point => map.set(pointKey(point), point))
    return map
  }, [points])

  const monitored = selectedKeys
    .map(key => pointByKey.get(key))
    .filter(Boolean)

  const uniqueGroups = [...new Set(points.map(point => point.group))].sort((a, b) => a - b)

  const filteredPoints = points.filter(point => {
    const matchesGroup = groupFilter === 'all' || point.group === Number(groupFilter)
    const haystack = `${point.index} ${point.group} ${point.variation} ${point.source_type} ${point.description} ${point.value}`.toLowerCase()
    return matchesGroup && haystack.includes(search.toLowerCase())
  })

  const addPoint = (point) => {
    const key = pointKey(point)
    setSelectedKeys(prev => prev.includes(key) ? prev : [...prev, key])
  }

  const removePoint = (point) => {
    const key = pointKey(point)
    setSelectedKeys(prev => prev.filter(item => item !== key))
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '360px 1fr' }, gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Point Selector</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Refresh points">
            <IconButton size="small" onClick={fetchPoints}><RefreshIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <FormControl size="small" sx={{ minWidth: 132 }}>
            <InputLabel>Group</InputLabel>
            <Select value={groupFilter} label="Group" onChange={event => setGroupFilter(event.target.value)}>
              <MenuItem value="all">All</MenuItem>
              {uniqueGroups.map(group => (
                <MenuItem key={group} value={group}>{group} - {groupNames[group] || 'Group'}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            sx={{ flex: 1 }}
          />
        </Box>

        <TableContainer sx={{ maxHeight: 520 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Point</TableCell>
                <TableCell sx={{ fontSize: 11, fontWeight: 700 }}>Value</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPoints.map(point => {
                const key = pointKey(point)
                const selected = selectedKeys.includes(key)
                return (
                  <TableRow key={key} hover selected={selected}>
                    <TableCell sx={{ fontSize: 11 }}>
                      <Box sx={{ fontWeight: 700 }}>{formatPointLabel(point)}</Box>
                      <Box sx={{ color: '#6b7280' }}>G{point.group}V{point.variation} I{point.index}</Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: 11, fontFamily: 'monospace' }}>{point.value}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={selected ? 'Already monitored' : 'Add to monitor'}>
                        <span>
                          <IconButton size="small" disabled={selected} onClick={() => addPoint(point)}>
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>SCADA Monitor</Typography>
          <Box sx={{ flex: 1 }} />
          <Chip label={`${monitored.length} monitored`} size="small" />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }, gap: 1.25 }}>
          {monitored.map(point => (
            <Paper key={pointKey(point)} variant="outlined" sx={{ p: 1.25, borderRadius: 1, minHeight: 116 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#111827' }} noWrap>
                    {formatPointLabel(point)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
                    G{point.group}V{point.variation} · Index {point.index} · {point.source_type || 'unknown'}
                  </Typography>
                </Box>
                <Tooltip title="Remove">
                  <IconButton size="small" onClick={() => removePoint(point)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography sx={{ mt: 1, fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: valueColor(point), fontFamily: 'monospace' }}>
                {String(point.value)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                <Chip label={point.quality || 'quality'} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                <Typography sx={{ fontSize: 10.5, color: '#6b7280' }} noWrap>{point.timestamp || '-'}</Typography>
              </Box>
            </Paper>
          ))}
        </Box>

        {monitored.length === 0 && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: '#9ca3af', borderRadius: 1 }}>
            <Typography variant="body2">Add points from the selector to build this monitor.</Typography>
          </Paper>
        )}

        {selectedKeys.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Button size="small" color="error" variant="outlined" onClick={() => setSelectedKeys([])}>
              Clear monitor
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}
