import React, { useState } from 'react'
import { Box, Grid, TextField, Switch, FormControlLabel, Typography, Button, Paper } from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import { api } from '../../services/api'

export default function PollingConfigTab({ client, onUpdated }) {
  const [config, setConfig] = useState({ ...client.polling_config })

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    try {
      const updated = await api.updateMasterConfig(client.id, { polling_config: config })
      onUpdated(updated)
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Polling Configuration</Typography>
        <Button startIcon={<SaveIcon />} variant="contained" size="small" onClick={handleSave}>Save</Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <TextField fullWidth label="Integrity Poll Interval (sec)" type="number"
              value={config.integrity_poll_interval}
              onChange={e => update('integrity_poll_interval', parseInt(e.target.value))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth label="Class 1 Poll Interval (sec)" type="number"
              value={config.class1_poll_interval}
              onChange={e => update('class1_poll_interval', parseInt(e.target.value))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth label="Class 2 Poll Interval (sec)" type="number"
              value={config.class2_poll_interval}
              onChange={e => update('class2_poll_interval', parseInt(e.target.value))} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth label="Class 3 Poll Interval (sec)" type="number"
              value={config.class3_poll_interval}
              onChange={e => update('class3_poll_interval', parseInt(e.target.value))} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={config.enable_unsolicited}
                onChange={e => update('enable_unsolicited', e.target.checked)} />}
              label="Enable Unsolicited Messages"
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
