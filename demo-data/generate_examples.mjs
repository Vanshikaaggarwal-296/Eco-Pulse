import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDir = dirname(fileURLToPath(import.meta.url))
mkdirSync(outputDir, { recursive: true })

function round(value) {
  return Number(value.toFixed(2))
}

function localTimestamp(year, monthIndex, day, hourIndex) {
  // Convert a local Asia/Kolkata wall-clock time into an ISO timestamp with +05:30.
  const instant = new Date(Date.UTC(year, monthIndex, day, hourIndex - 5, -30))
  const local = new Date(instant.getTime() + 330 * 60_000)
  const pad = value => String(value).padStart(2, '0')
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:00:00+05:30`
}

const importRows = ['timestamp,building,consumption_kwh,solar_used_kwh,grid_import_kwh,cost_inr,carbon_kg,occupancy']
for (let hour = 0; hour < 24; hour += 1) {
  for (const building of ['SYNTHETIC_DEMO_ACADEMIC_BLOCK', 'SYNTHETIC_DEMO_LIBRARY']) {
    const isAcademic = building.includes('ACADEMIC')
    const occupied = hour >= 8 && hour <= (isAcademic ? 18 : 20)
    const occupancy = occupied
      ? Math.max(1, Math.round((isAcademic ? 28 : 18) + 12 * Math.sin(Math.PI * (hour - 8) / (isAcademic ? 10 : 12))))
      : 0
    const dailyShape = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12))
    const consumption = round((isAcademic ? 34 : 21) + occupancy * (isAcademic ? 1.15 : 0.9) + 3 * Math.cos(2 * Math.PI * (hour - 15) / 24))
    const solar = round(Math.min(consumption * 0.42, dailyShape * (isAcademic ? 24 : 15)))
    const grid = round(consumption - solar)
    const cost = round(grid * 8.25)
    const carbon = round(grid * 0.71)
    importRows.push([
      localTimestamp(2026, 9, 25, hour), building, consumption, solar, grid, cost, carbon, occupancy,
    ].join(','))
  }
}

writeFileSync(join(outputDir, 'synthetic_campus_energy_import.csv'), `${importRows.join('\n')}\n`, 'utf8')

const forecastRows = ['timestamp,building_id,demand_kw,occupancy,solar_kw,battery_soc_pct']
const firstDay = new Date(Date.UTC(2026, 8, 28))
for (let index = 0; index < 35 * 24; index += 1) {
  const day = Math.floor(index / 24)
  const hour = index % 24
  const weekday = new Date(firstDay.getTime() + day * 86_400_000).getUTCDay()
  const weekend = weekday === 0 || weekday === 6
  let occupancy
  if (hour >= 8 && hour <= 18) {
    occupancy = Math.round(18 + 23 * Math.sin(Math.PI * (hour - 8) / 10) + 3 * Math.sin(day * 0.73) - (weekend ? 12 : 0))
  } else if (hour >= 19 && hour <= 21) {
    occupancy = weekend ? 2 : 6
  } else {
    occupancy = 0
  }
  occupancy = Math.max(0, occupancy)

  const daylight = hour >= 6 && hour <= 17
    ? Math.sin(Math.PI * (hour - 6) / 11)
    : 0
  const solar = round(Math.max(0, daylight * 19 * (0.88 + 0.12 * Math.sin(day * 0.17))))
  const dailyDemand = 16 + occupancy * 0.58 + 3.2 * Math.cos(2 * Math.PI * (hour - 14) / 24)
  const weeklyEffect = weekend ? -2.4 : 0
  const gentleVariation = 0.9 * Math.sin(day * 0.61 + hour * 0.23)
  const demand = round(Math.max(5, dailyDemand + weeklyEffect + gentleVariation))
  const batterySoc = round(55 + 12 * Math.sin(2 * Math.PI * hour / 24 - 0.6))

  forecastRows.push([
    localTimestamp(2026, 8, 28, index),
    'SYNTHETIC_DEMO_ACADEMIC_BLOCK', demand, occupancy, solar, batterySoc,
  ].join(','))
}

writeFileSync(join(outputDir, 'synthetic_forecasting_history_35d.csv'), `${forecastRows.join('\n')}\n`, 'utf8')
console.log(`Wrote ${importRows.length - 1} import rows and ${forecastRows.length - 1} forecasting rows to ${outputDir}`)
