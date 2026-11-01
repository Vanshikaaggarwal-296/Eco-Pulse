import test from 'node:test'
import assert from 'node:assert/strict'
import { uploadEnergyReadings } from '../src/energyApi.js'

test('batch import maps CSV rows to backend energy readings', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => ({ created_count: 1 }) }
  }

  try {
    const result = await uploadEnergyReadings([{
      timestamp: '2026-10-31T08:00:00+05:30',
      building: 'Academic Block A',
      consumption_kwh: 12.5,
      solar_used_kwh: null,
      occupancy: 23
    }])
    assert.equal(result.created_count, 1)
    assert.equal(request.url, '/api/energy/readings/batch')
    assert.equal(request.options.method, 'POST')
    assert.deepEqual(JSON.parse(request.options.body), {
      readings: [{
        timestamp: '2026-10-31T08:00:00+05:30',
        building_id: 'Academic Block A',
        consumption_kwh: 12.5,
        solar_generation_kwh: 0,
        occupancy: 23
      }]
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('batch import surfaces backend duplicate and validation errors', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({ detail: 'A reading already exists.' })
  })

  try {
    await assert.rejects(
      uploadEnergyReadings([]),
      { message: 'A reading already exists.' }
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
