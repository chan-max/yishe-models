const PYTHON_RUNTIME_BASE = process.env.PYTHON_RUNTIME_BASE || 'http://127.0.0.1:8001'

async function requestJson(path, method = 'GET') {
  const response = await fetch(`${PYTHON_RUNTIME_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' }
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Python runtime ${method} ${path} failed: ${response.status} ${text}`)
  }
  return response.json()
}

function getRuntimeHealth() {
  return requestJson('/health')
}

function getRuntimeModels() {
  return requestJson('/models')
}

function startModel(id) {
  return requestJson(`/models/${id}/start`, 'POST')
}

function stopModel(id) {
  return requestJson(`/models/${id}/stop`, 'POST')
}

module.exports = {
  getRuntimeHealth,
  getRuntimeModels,
  startModel,
  stopModel
}
