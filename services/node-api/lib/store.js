const fs = require('fs')
const path = require('path')

const registryFile = path.join(__dirname, '..', 'data', 'registry.json')

function readRegistry() {
  return JSON.parse(fs.readFileSync(registryFile, 'utf8'))
}

function writeRegistry(payload) {
  fs.writeFileSync(registryFile, JSON.stringify(payload, null, 2))
}

function listModels() {
  return readRegistry().models
}

function listProviders() {
  return readRegistry().providers
}

function listEndpoints() {
  return readRegistry().endpoints
}

function updateModelStatus(id, status) {
  const registry = readRegistry()
  registry.models = registry.models.map((model) =>
    model.id === id ? { ...model, status, updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') } : model
  )
  writeRegistry(registry)
  return registry.models.find((model) => model.id === id)
}

function mergeRuntimeModels(runtimeModels) {
  const registry = readRegistry()
  const existing = new Map(registry.models.map((item) => [item.id, item]))
  for (const runtimeModel of runtimeModels) {
    const current = existing.get(runtimeModel.id) || {}
    existing.set(runtimeModel.id, {
      ...current,
      ...runtimeModel,
      runtime: 'python',
      updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    })
  }
  registry.models = Array.from(existing.values())
  writeRegistry(registry)
  return registry.models
}

module.exports = {
  listModels,
  listProviders,
  listEndpoints,
  updateModelStatus,
  mergeRuntimeModels
}
