const apiBase = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '')

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
