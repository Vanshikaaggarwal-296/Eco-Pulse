const apiBase = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function readJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status})`)
  }
  return body
}

export async function getAllEnergyReadings() {
  const pageSize = 500
  const rows = []
  let offset = 0
  let total = Infinity
  while (offset < total) {
    const page = await readJson(`${apiBase}/api/energy/readings?limit=${pageSize}&offset=${offset}`)
    rows.push(...(page.readings || []))
    total = page.total_count ?? rows.length
    offset += page.count || 0
    if (!page.count) break
  }
  return rows
}

export async function getAssetTelemetry(assetType) {
  const query = assetType ? `?asset_type=${encodeURIComponent(assetType)}&limit=1000` : '?limit=1000'
  const body = await readJson(`${apiBase}/api/energy/telemetry${query}`)
  return body.readings || []
}

export async function uploadEnergyReadings(rows) {
  const response = await fetch(`${apiBase}/api/energy/readings/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      readings: rows.map(row => ({
        timestamp: row.timestamp,
        building_id: row.building,
        consumption_kwh: row.consumption_kwh,
        // The import field is actual solar used on site, which is the portion
        // that offsets consumption in the backend's simplified energy model.
        solar_generation_kwh: row.solar_used_kwh ?? 0,
        occupancy: row.occupancy,
        grid_import_kwh: row.grid_import_kwh,
        cost_inr: row.cost_inr,
        carbon_kg: row.carbon_kg
      }))
    })
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    const message = Array.isArray(detail)
      ? detail.map(item => item.msg || JSON.stringify(item)).join('; ')
      : typeof detail === 'string' ? detail : `Request failed (${response.status})`
    throw new Error(message)
  }
  return body
}
