export const fields = [
  ['timestamp', 'Timestamp (ISO 8601 with timezone)', true],
  ['building', 'Building / asset name', true],
  ['consumption_kwh', 'Energy consumed (kWh per interval)', true],
  ['solar_used_kwh', 'Solar energy consumed (kWh)', false],
  ['grid_import_kwh', 'Grid energy consumed (kWh)', false],
  ['cost_inr', 'Recorded energy cost (INR)', false],
  ['carbon_kg', 'Recorded grid emissions (kg CO₂e)', false]
]
const aliases = {
  timestamp:['timestamp','datetime','recordedat','time'], building:['building','buildingname','asset','assetname'],
  consumption_kwh:['consumptionkwh','energykwh','energyconsumedkwh','energyusekwh'],
  solar_used_kwh:['solarusedkwh','solarconsumedkwh'], grid_import_kwh:['gridimportkwh','gridconsumedkwh'],
  cost_inr:['costinr','energycostinr','costrs'], carbon_kg:['carbonkg','emissionskg','co2kg','co2ekg']
}
export function detectMapping(headers) {
  const clean = headers.map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,''))
  return Object.fromEntries(fields.map(([key])=>[key,headers[clean.findIndex(x=>aliases[key].includes(x))] || '']))
}
// RFC-style quoted fields, escaped quotes, CRLF, embedded newlines and UTF-8 BOM.
export function parseCSV(text) {
  if (text.length > 5 * 1024 * 1024) throw new Error('Choose a CSV smaller than 5 MB.')
  text = text.replace(/^\uFEFF/,'')
  const table=[]; let row=[], field='', quoted=false, endedQuote=false
  const pushRow=()=>{row.push(field);if(row.some(x=>x.trim()!==''))table.push(row);row=[];field='';endedQuote=false}
  for(let i=0;i<text.length;i++) {
    const c=text[i]
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;endedQuote=true}}else field+=c;continue}
    if(c==='"'){if(field!==''||endedQuote)throw new Error('Unexpected quote in CSV. Use a comma-separated UTF-8 export.');quoted=true}
    else if(c===','){row.push(field);field='';endedQuote=false}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow()}
    else {if(endedQuote)throw new Error('Unexpected text after a closing quote.');field+=c}
  }
  if(quoted)throw new Error('A quoted CSV field is not closed.')
  if(field!==''||row.length||endedQuote)pushRow()
  if(table.length<2)throw new Error('Include a header row and at least one data row.')
  if(table.length>10001)throw new Error('Import at most 10,000 data rows at a time.')
  const headers=table.shift().map(x=>x.trim())
  if(headers.some(x=>!x)||new Set(headers.map(x=>x.toLowerCase())).size!==headers.length)throw new Error('Every column needs a unique, non-empty header.')
  const bad=table.findIndex(r=>r.length!==headers.length)
  if(bad!==-1)throw new Error(`Data row ${bad+1} has ${table[bad].length} values; expected ${headers.length}.`)
  return {headers,rows:table}
}
function timestampValid(value) {
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if(!m)return false
  const [y,mo,d,h,mi,se]=m.slice(1,7).map(x=>Number(x||0))
  const calendar=new Date(Date.UTC(y,mo-1,d))
  return calendar.getUTCFullYear()===y&&calendar.getUTCMonth()===mo-1&&calendar.getUTCDate()===d&&h<24&&mi<60&&se<60&&Number.isFinite(Date.parse(value))
}
export function validateRows(csv,mapping) {
  for(const [key,label,required] of fields)if(required&&!mapping[key])return {rows:[],errors:[`Map the required column: ${label}.`]}
  const chosen=Object.values(mapping).filter(Boolean)
  if(new Set(chosen).size!==chosen.length)return {rows:[],errors:['Map each source column to one field only.']}
  for(const column of chosen)if(!csv.headers.includes(column))return {rows:[],errors:[`Column not found: ${column}.`]}
  const indexes=Object.fromEntries(fields.map(([key])=>[key,csv.headers.indexOf(mapping[key])]))
  const rows=[],errors=[],seen=new Set()
  csv.rows.forEach((raw,i)=>{
    const n=i+1;const row={};const before=errors.length
    fields.forEach(([key,,required])=>{
      const value=(raw[indexes[key]]||'').trim()
      if(key==='timestamp'){if(!timestampValid(value))errors.push(`Data row ${n}: timestamp must be an ISO date/time with a timezone (e.g. 2026-10-31T08:00:00+05:30).`);row[key]=value}
      else if(key==='building'){if(!value)errors.push(`Data row ${n}: building is empty.`);row[key]=value}
      else if(!value){row[key]=null;if(required)errors.push(`Data row ${n}: ${key} is missing.`)}
      else if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)||!Number.isFinite(Number(value))){errors.push(`Data row ${n}: ${key} must be a non-negative number without currency signs or thousands separators.`);row[key]=null}
      else row[key]=Number(value)
    })
    if(errors.length===before){
      const id=`${new Date(row.timestamp).toISOString()}|${row.building.toLowerCase()}`
      if(seen.has(id))errors.push(`Data row ${n}: duplicate timestamp/building pair.`)
      seen.add(id)
      if((row.solar_used_kwh??0)+(row.grid_import_kwh??0)>row.consumption_kwh+1e-6)errors.push(`Data row ${n}: solar used + grid import exceeds total consumption.`)
    }
    rows.push(row)
  })
  return {rows:errors.length?[]:rows,errors}
}
export function summarize(rows) {
  const totals={};for(const [key] of fields.slice(2))totals[key]=rows.every(r=>typeof r[key]==='number')?rows.reduce((sum,r)=>sum+r[key],0):null
  const byBuilding=new Map(),byTime=new Map()
  rows.forEach(r=>{byBuilding.set(r.building,(byBuilding.get(r.building)||0)+r.consumption_kwh);const time=new Date(r.timestamp).toISOString();byTime.set(time,(byTime.get(time)||0)+r.consumption_kwh)})
  let series=[...byTime].sort(([a],[b])=>a.localeCompare(b)),daily=series.length>240
  if(daily){const days=new Map();series.forEach(([t,v])=>days.set(t.slice(0,10),(days.get(t.slice(0,10))||0)+v));series=[...days]}
  return {totals,buildings:[...byBuilding].sort((a,b)=>b[1]-a[1]),series,daily,rowCount:rows.length,solarShare:totals.solar_used_kwh!==null&&totals.consumption_kwh>0?100*totals.solar_used_kwh/totals.consumption_kwh:null}
}
