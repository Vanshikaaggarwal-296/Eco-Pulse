const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function runForecastAnalysis(payload) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  try {
    const response = await fetch(`${apiBase}/api/forecasting/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
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
  } finally {
    clearTimeout(timeout)
  }
}

export async function getLatestForecastAnalysis() {
  const response = await fetch(`${apiBase}/api/forecasting/runs/latest`, {
    headers: { Accept: 'application/json' }
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.detail || `Request failed (${response.status})`)
  return body?.run || null
}
