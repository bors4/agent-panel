const API_BASE = 'http://127.0.0.1:3000/api'
const API_KEY = 'agent-secret-key'

export async function apiFetch(endpoint, options = {}) {
  const headers = { 
    'Content-Type': 'application/json', 
    'x-api-key': API_KEY, 
    ...options.headers 
  }
  
  const resp = await fetch(`${API_BASE}${endpoint}`, { 
    ...options, 
    headers 
  })
  
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }))
    throw new Error(err.error || `HTTP ${resp.status}`)
  }
  
  return resp.json()
}

export const agentApi = {
  getStatus: () => apiFetch('/status'),
  start: () => apiFetch('/start', { method: 'POST' }),
  stop: () => apiFetch('/stop', { method: 'POST' }),
  restart: () => apiFetch('/restart', { method: 'POST' }),
  getLogs: (limit = 100) => apiFetch(`/logs?limit=${limit}`),
  updateConfig: (config) => apiFetch('/config', { 
    method: 'POST', 
    body: JSON.stringify(config) 
  }),
  chat: (message) => apiFetch('/chat', { 
    method: 'POST', 
    body: JSON.stringify({ message }) 
  })
}