const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function postJson(path, payload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(apiBase + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = typeof body?.detail === 'string' ? body.detail : 'Request failed (' + response.status + ')'
      throw new Error(detail)
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}

export function runScheduleRecommendation() {
  return postJson('/api/optimization/schedule', {
    demand_kwh: [2, 3, 4.5, 3.5],
    solar_kwh: [0, 2, 1, 0],
    price_per_kwh: [4, 2, 3, 9],
    carbon_kg_per_kwh: [0.65, 0.35, 0.4, 0.8],
    battery: {
      capacity_kwh: 12,
      initial_soc_kwh: 6,
      min_soc_kwh: 2,
      reserve_soc_kwh: 3,
      max_charge_kw: 4,
      max_discharge_kw: 4,
      charge_efficiency: 0.92,
      discharge_efficiency: 0.94,
      degradation_cost_per_kwh: 0.02
    },
    critical_load_kwh: [1, 1, 1.5, 1.5],
    hvac_load_kwh: [0.5, 0.6, 0.8, 0.7],
    hvac_min_kwh: [0.4, 0.5, 0.6, 0.6],
    flexible_load_kwh: [0, 0.5, 0.5, 0.5],
    carbon_weight: 2,
    flexible_shed_penalty_per_kwh: 20,
    hvac_reduction_penalty_per_kwh: 20,
    max_grid_import_kw: 3,
    step_hours: 1,
    soc_steps: 12
  })
}

export function runOutageSimulation(hours) {
  const renewableProfile = Array.from({ length: hours }, (_, index) => index % 4 === 1 ? 0.5 : 0)
  return postJson('/api/optimization/outage', {
    critical_load_kwh: Array(hours).fill(2),
    renewable_kwh: renewableProfile,
    battery: {
      capacity_kwh: 20,
      initial_soc_kwh: 16,
      min_soc_kwh: 4,
      reserve_soc_kwh: 0,
      max_charge_kw: 0,
      max_discharge_kw: 5,
      charge_efficiency: 0.95,
      discharge_efficiency: 0.94,
      degradation_cost_per_kwh: 0
    },
    step_hours: 1
  })
}
