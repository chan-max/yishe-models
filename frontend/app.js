const API_BASE = 'http://127.0.0.1:8787'

const mockData = {
  overview: {
    metrics: [
      { label: 'Managed Models', value: '06', trend: '+2 this week', tone: 'primary' },
      { label: 'Runtime Nodes', value: '02', trend: 'node + python', tone: 'success' },
      { label: 'API Requests', value: '18.4k', trend: '7d rolling', tone: 'warning' },
      { label: 'Failures', value: '0.8%', trend: 'below alert line', tone: 'danger' }
    ],
    architecture: [
      {
        title: 'Independent UI',
        role: 'Operate local model services directly',
        techStack: ['HTML', 'CSS', 'JavaScript'],
        description: 'This standalone console lives inside yishe-models and no longer depends on yishe-admin.'
      },
      {
        title: 'Business API',
        role: 'Expose stable APIs and orchestration rules',
        techStack: ['Node.js', 'HTTP', 'JSON store'],
        description: 'Registry, routing and lifecycle orchestration are handled by the local Node service.'
      },
      {
        title: 'Model Runtime',
        role: 'Own local inference and adapters',
        techStack: ['Python', 'HTTPServer', 'Workers'],
        description: 'The Python runtime wraps local models and exposes state back to the Node layer.'
      }
    ],
    recentActivities: [
      { id: 'act-1', title: 'Frontend switched to standalone yishe-models console', time: '2026-03-12 15:40', type: 'deploy' },
      { id: 'act-2', title: 'Node business API ready for registry sync', time: '2026-03-12 15:35', type: 'api' },
      { id: 'act-3', title: 'Python runtime health endpoint available', time: '2026-03-12 15:21', type: 'runtime' },
      { id: 'act-4', title: 'Voice worker still marked degraded in demo catalog', time: '2026-03-12 13:57', type: 'alert' }
    ]
  },
  models: [
    {
      id: 'qwen2.5-7b-instruct',
      name: 'Qwen 2.5 7B Instruct',
      family: 'Qwen',
      provider: 'Local GPU Worker',
      runtime: 'python',
      endpoint: '/api/llm/chat',
      status: 'running',
      mode: 'chat',
      updatedAt: '2026-03-12 15:10',
      tags: ['quantized', 'local', 'chat']
    },
    {
      id: 'bge-m3',
      name: 'BGE M3',
      family: 'BGE',
      provider: 'Embedding Worker',
      runtime: 'python',
      endpoint: '/api/llm/embedding',
      status: 'running',
      mode: 'embedding',
      updatedAt: '2026-03-12 14:30',
      tags: ['embedding', 'rerank']
    },
    {
      id: 'cosyvoice-clone',
      name: 'CosyVoice Clone',
      family: 'CosyVoice',
      provider: 'Voice Worker',
      runtime: 'python',
      endpoint: '/api/llm/voice/clone',
      status: 'degraded',
      mode: 'tts',
      updatedAt: '2026-03-12 13:57',
      tags: ['voice-clone', 'audio']
    }
  ],
  providers: [
    {
      id: 'provider-node',
      name: 'Node Business API',
      host: 'http://127.0.0.1:8787',
      protocol: 'HTTP JSON',
      queueDepth: 12,
      status: 'online'
    },
    {
      id: 'provider-python',
      name: 'Python Runtime',
      host: 'http://127.0.0.1:8001',
      protocol: 'HTTP JSON',
      queueDepth: 3,
      status: 'warning'
    }
  ],
  endpoints: [
    {
      id: 'endpoint-chat',
      method: 'POST',
      path: '/api/llm/chat',
      target: 'qwen2.5-7b-instruct',
      description: 'Unified chat completion entrypoint for local conversational models.'
    },
    {
      id: 'endpoint-embedding',
      method: 'POST',
      path: '/api/llm/embedding',
      target: 'bge-m3',
      description: 'Embedding and semantic retrieval endpoint for internal services.'
    },
    {
      id: 'endpoint-voice',
      method: 'POST',
      path: '/api/llm/voice/clone',
      target: 'cosyvoice-clone',
      description: 'Voice clone and synthesis endpoint routed to the Python audio worker.'
    },
    {
      id: 'endpoint-overview',
      method: 'GET',
      path: '/api/console/overview',
      target: 'console',
      description: 'Overview payload for the standalone yishe-models console.'
    }
  ]
}

const state = {
  overview: mockData.overview,
  models: mockData.models,
  providers: mockData.providers,
  endpoints: mockData.endpoints
}

const els = {
  metrics: document.getElementById('metrics'),
  architecture: document.getElementById('architecture'),
  activities: document.getElementById('activities'),
  modelTable: document.getElementById('modelTable'),
  providers: document.getElementById('providers'),
  endpoints: document.getElementById('endpoints'),
  syncBtn: document.getElementById('syncBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  toast: document.getElementById('toast')
}

function toast(message) {
  els.toast.textContent = message
  els.toast.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2400)
}

function pillTone(kind) {
  if (kind === 'running' || kind === 'online' || kind === 'success' || kind === 'runtime') return 'success'
  if (kind === 'degraded' || kind === 'warning' || kind === 'alert') return 'warning'
  if (kind === 'stopped' || kind === 'offline' || kind === 'danger') return 'danger'
  if (kind === 'deploy' || kind === 'primary') return 'primary'
  return 'info'
}

function renderMetrics() {
  els.metrics.innerHTML = state.overview.metrics.map((metric) => `
    <article class="metric-card">
      <div class="metric-label">${metric.label}</div>
      <div class="metric-value">${metric.value}</div>
      <span class="pill ${pillTone(metric.tone)}">${metric.trend}</span>
    </article>
  `).join('')
}

function renderArchitecture() {
  els.architecture.innerHTML = state.overview.architecture.map((item) => `
    <article class="stack-card">
      <div class="stack-header">
        <strong>${item.title}</strong>
        <span class="stack-role">${item.role}</span>
      </div>
      <p>${item.description}</p>
      <div class="tag-row">
        ${item.techStack.map((tech) => `<span class="tag-chip">${tech}</span>`).join('')}
      </div>
    </article>
  `).join('')
}

function renderActivities() {
  els.activities.innerHTML = state.overview.recentActivities.map((item) => `
    <article class="activity-card">
      <div class="activity-top">
        <strong>${item.title}</strong>
        <span class="pill ${pillTone(item.type)}">${item.type}</span>
      </div>
      <div class="activity-time">${item.time}</div>
    </article>
  `).join('')
}

function renderModels() {
  els.modelTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th>Mode</th>
          <th>Provider</th>
          <th>API</th>
          <th>Tags</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.models.map((model) => `
          <tr>
            <td>
              <strong>${model.name}</strong>
              <div class="table-subtle">${model.family} · ${model.updatedAt}</div>
            </td>
            <td>${model.mode}</td>
            <td>${model.provider}</td>
            <td><code>${model.endpoint}</code></td>
            <td><div class="tag-row">${model.tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join('')}</div></td>
            <td><span class="pill ${pillTone(model.status)}">${model.status}</span></td>
            <td>
              <div class="action-row">
                <button class="small-button primary" data-action="start" data-id="${model.id}">启动</button>
                <button class="small-button" data-action="stop" data-id="${model.id}">停止</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

function renderProviders() {
  els.providers.innerHTML = state.providers.map((provider) => `
    <article class="provider-card">
      <div class="provider-top">
        <strong>${provider.name}</strong>
        <span class="pill ${pillTone(provider.status)}">${provider.status}</span>
      </div>
      <div class="provider-meta">${provider.host}</div>
      <div class="provider-meta">${provider.protocol} · queue ${provider.queueDepth}</div>
    </article>
  `).join('')
}

function renderEndpoints() {
  els.endpoints.innerHTML = state.endpoints.map((endpoint) => `
    <article class="endpoint-card">
      <div class="endpoint-top">
        <div class="endpoint-path">
          <span class="pill ${endpoint.method === 'GET' ? 'success' : 'primary'}">${endpoint.method}</span>
          <code>${endpoint.path}</code>
        </div>
        <span class="endpoint-meta">${endpoint.target}</span>
      </div>
      <p>${endpoint.description}</p>
    </article>
  `).join('')
}

function render() {
  renderMetrics()
  renderArchitecture()
  renderActivities()
  renderModels()
  renderProviders()
  renderEndpoints()
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json()
}

async function loadData() {
  try {
    const [overview, models, providers, endpoints] = await Promise.all([
      api('/api/console/overview'),
      api('/api/console/models'),
      api('/api/console/providers'),
      api('/api/console/endpoints')
    ])
    state.overview = overview
    state.models = models
    state.providers = providers
    state.endpoints = endpoints
    toast('已连接到本地 Node API。')
  } catch (error) {
    state.overview = mockData.overview
    state.models = mockData.models
    state.providers = mockData.providers
    state.endpoints = mockData.endpoints
    toast('Node API 未启动，当前使用演示数据。')
  }
  render()
}

async function syncRuntime() {
  try {
    const result = await api('/api/console/runtime/sync', { method: 'POST' })
    toast(result.message || '同步完成')
  } catch (error) {
    toast('运行时未启动，已保留演示数据。')
  }
  await loadData()
}

async function changeModel(action, id) {
  try {
    const result = await api(`/api/console/models/${id}/${action}`, { method: 'POST' })
    toast(result.message || `${action} ok`)
  } catch (error) {
    toast(`模型 ${id} ${action} 失败，可能后端未启动。`)
  }
  await loadData()
}

els.refreshBtn.addEventListener('click', loadData)
els.syncBtn.addEventListener('click', syncRuntime)
els.modelTable.addEventListener('click', (event) => {
  const target = event.target.closest('button[data-action]')
  if (!target) return
  changeModel(target.dataset.action, target.dataset.id)
})

loadData()
