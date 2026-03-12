const http = require('http')
const { URL } = require('url')
const { listModels, listProviders, listEndpoints, updateModelStatus, mergeRuntimeModels } = require('./lib/store')
const { getRuntimeHealth, getRuntimeModels, startModel, stopModel } = require('./lib/pythonRuntime')

const PORT = Number(process.env.PORT || 8787)

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
  res.end(JSON.stringify(payload))
}

function buildOverview() {
  const models = listModels()
  const providers = listProviders()
  return {
    metrics: [
      { label: 'Managed Models', value: String(models.length).padStart(2, '0'), trend: 'registry snapshot', tone: 'primary' },
      { label: 'Runtime Nodes', value: String(providers.length).padStart(2, '0'), trend: 'node + python', tone: 'success' },
      { label: 'Running Models', value: String(models.filter((item) => item.status === 'running').length), trend: 'active now', tone: 'warning' },
      { label: 'Degraded', value: String(models.filter((item) => item.status === 'degraded').length), trend: 'requires attention', tone: 'danger' }
    ],
    architecture: [
      {
        title: 'Admin UI',
        role: 'Operate and audit local model services',
        techStack: ['Vue 3', 'Element Plus', 'Vite'],
        description: 'The admin console shows the registry, provider state and API catalog.'
      },
      {
        title: 'Business API',
        role: 'Expose stable APIs and orchestration rules',
        techStack: ['Node.js', 'HTTPServer'],
        description: 'The Node service owns orchestration and talks to the Python runtime.'
      },
      {
        title: 'Model Runtime',
        role: 'Wrap local model execution',
        techStack: ['Python', 'HTTPServer'],
        description: 'The Python service exposes model health, lifecycle and inference adapters.'
      }
    ],
    recentActivities: [
      { id: 'recent-1', title: 'Node registry loaded from local JSON store', time: new Date().toISOString(), type: 'api' },
      { id: 'recent-2', title: 'Console can sync model states from Python runtime', time: new Date().toISOString(), type: 'runtime' }
    ]
  }
}

async function handleRequest(req, res) {
  if (!req.url) {
    sendJson(res, 404, { message: 'Not Found' })
    return
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  try {
    if (req.method === 'GET' && path === '/health') {
      const runtime = await getRuntimeHealth().catch((error) => ({ status: 'warning', error: error.message }))
      sendJson(res, 200, { service: 'node-api', status: 'ok', runtime })
      return
    }

    if (req.method === 'GET' && path === '/api/console/overview') {
      sendJson(res, 200, buildOverview())
      return
    }

    if (req.method === 'GET' && path === '/api/console/models') {
      sendJson(res, 200, listModels())
      return
    }

    if (req.method === 'GET' && path === '/api/console/providers') {
      sendJson(res, 200, listProviders())
      return
    }

    if (req.method === 'GET' && path === '/api/console/endpoints') {
      sendJson(res, 200, listEndpoints())
      return
    }

    if (req.method === 'POST' && path === '/api/console/runtime/sync') {
      const runtimeModels = await getRuntimeModels()
      const models = mergeRuntimeModels(runtimeModels.models || runtimeModels)
      sendJson(res, 200, { success: true, message: `Synced ${models.length} models from python runtime.` })
      return
    }

    const modelActionMatch = path.match(/^\/api\/console\/models\/([^/]+)\/(start|stop)$/)
    if (req.method === 'POST' && modelActionMatch) {
      const [, id, action] = modelActionMatch
      if (action === 'start') {
        await startModel(id)
        updateModelStatus(id, 'running')
        sendJson(res, 200, { success: true, message: `Model ${id} started.` })
        return
      }
      await stopModel(id)
      updateModelStatus(id, 'stopped')
      sendJson(res, 200, { success: true, message: `Model ${id} stopped.` })
      return
    }

    sendJson(res, 404, { message: 'Not Found' })
  } catch (error) {
    sendJson(res, 500, { message: error.message })
  }
}

http.createServer((req, res) => {
  handleRequest(req, res)
}).listen(PORT, () => {
  console.log(`yishe node api listening on http://127.0.0.1:${PORT}`)
})
