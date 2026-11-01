import React, { useEffect, useMemo, useState } from 'react'
import { MenuNavigation, RevealContent } from './Motion'
import { DataImport, ImportedOverview } from './DataImport'
import { useData } from './DataContext'
import ApiStatus from './ApiStatus'
import { runOutageSimulation, runScheduleRecommendation } from './optimizationApi'
import { parseCSV } from './data'
import { runForecastAnalysis } from './forecastingApi'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BatteryCharging, Bell,
  Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Database,
  CloudSun, Cpu, Download, Gauge, Leaf, Lightbulb, Menu, Moon, MoreHorizontal,
  PlugZap, Power, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal,
  Snowflake, Sun, Thermometer, TrendingDown, Upload, Zap, X
} from 'lucide-react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Filler, Tooltip, Legend
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend)


// Keep the outgoing view mounted until its exit completes; rapid clicks use the latest target.
function useAnimatedValue(initialValue) {
  const [requested, setRequested] = useState(initialValue)
  const [value, setValue] = useState(initialValue)
  const [phase, setPhase] = useState('entering')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (reducedMotion) {
      setValue(requested)
      setPhase('ready')
      return
    }
    if (requested !== value) {
      setPhase('leaving')
      const timer = window.setTimeout(() => setValue(requested), 150)
      return () => window.clearTimeout(timer)
    }
    setPhase('entering')
    const timer = window.setTimeout(() => setPhase('ready'), 620)
    return () => window.clearTimeout(timer)
  }, [requested, value, reducedMotion])
  return [value, setRequested, phase, requested]
}

function AmbientBackground() {
  return <div className="ambient-background" aria-hidden="true">
    <div className="ambient-orb orb-red"/><div className="ambient-orb orb-rose"/>
    <div className="ambient-orbit orbit-one"/><div className="ambient-orbit orbit-two"/>
    <div className="ambient-grid"/>
  </div>
}

const navGroups = [
  { label: 'WORKSPACE', items: [
    ['Overview', 'overview', Gauge], ['AI Forecasting', 'forecasting', Activity],
    ['Energy Optimization', 'optimization', SlidersHorizontal], ['Digital Twin', 'twin', Building2]
  ]},
  { label: 'ENERGY SYSTEMS', items: [
    ['Battery & Storage', 'battery', BatteryCharging], ['HVAC Management', 'hvac', Snowflake],
    ['Smart Loads', 'loads', PlugZap], ['Carbon Intelligence', 'carbon', Leaf]
  ]},
  { label: 'MONITORING', items: [
    ['Outage Simulation', 'outage', Power], ['Anomaly Detection', 'anomalies', AlertTriangle],
    ['Reports', 'reports', Download], ['Data & Imports', 'imports', Upload]
  ]}
]

const demandLabels = ['06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00']
const demandActual = [180,230,315,390,420,385,350,270,205]
const demandForecast = [175,245,325,400,430,395,360,280,215]

const lineOptions = {
  responsive: true, maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#291b1e', padding: 11, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#746b6c', font: { size: 10 } }, border: { display: false } },
    y: { grid: { color: '#eee4e0' }, ticks: { color: '#746b6c', font: { size: 10 }, callback: v => `${v} kW` }, border: { display: false } }
  }
}
const cardLineOptions = { ...lineOptions, plugins: { ...lineOptions.plugins, legend: { display: false } }, scales: { ...lineOptions.scales, y: { ...lineOptions.scales.y, ticks: { ...lineOptions.scales.y.ticks, display: false } }, x: { ...lineOptions.scales.x, ticks: { display: false } } } }

function Metric({ label, value, unit, change, positive=true, icon: Icon, tint='green', note }) {
  return <div className="metric-card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tint}`}><Icon size={17}/></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-foot"><span className={positive ? 'trend good' : 'trend bad'}>{positive ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>} {change}</span><span className="muted">{note}</span></div>
  </div>
}

function Header({ title, page, setPage }) {
  return <header className="topbar">
    <div className="header-identity"><div className="header-brand"><span className="brand-mark"><Leaf size={22}/></span><div><b>EcoPulse</b><span>ENERGY INTELLIGENCE</span></div></div>
      <div className="header-campus"><Building2 size={17}/><div><b>Greenfield Campus</b><span>Campus workspace</span></div></div>
    </div>
    <div className="header-context"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{title}</b></div>
      <div className="top-actions"><button className="btn header-import" onClick={()=>setPage('imports')}><Upload size={14}/> Import CSV</button><ApiStatus/><button className="icon-button" aria-label="Search"><Search size={18}/></button><button className="icon-button notification" aria-label="Notifications"><Bell size={18}/><i/></button><div className="avatar" title="Admin User">AD</div><MenuNavigation groups={navGroups} page={page} setPage={setPage}/></div>
    </div>
  </header>
}

function SectionTitle({ eyebrow, title, desc, right }) {
  return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1 tabIndex={-1}>{title}</h1><p>{desc}</p></div>{right && <div className="title-actions">{right}</div>}</div>
}
function Button({ children, kind='secondary', onClick, disabled=false }) { return <button className={`btn ${kind}`} onClick={onClick} disabled={disabled}>{children}</button> }

function Overview({ outage, setPage }) {
  const [range,setRange,rangePhase] = useAnimatedValue('Today')
  const [showTip,setShowTip] = useState(true)
  const {dataset,backendLoading,backendError}=useData()
  if(dataset) return <ImportedOverview setPage={setPage}/>
  if(backendLoading||backendError)return <><SectionTitle eyebrow="CAMPUS ENERGY OVERVIEW" title="Campus overview" desc="Overview uses energy readings saved in the shared backend."/><div className="panel forecast-empty">{backendLoading?'Loading shared campus readings…':`Shared readings are unavailable: ${backendError}`} <Button onClick={()=>setPage('imports')}>Open Data & Imports</Button></div></>
  return <><SectionTitle eyebrow="CAMPUS ENERGY OVERVIEW" title="Campus overview" desc="Start by importing campus readings. Overview metrics will be calculated from the shared backend data."/><div className="panel forecast-empty"><Database size={22}/><h3>No campus readings yet</h3><p>Import a CSV with real or clearly-labelled demo records. Recorded consumption, cost, carbon and building totals will appear here after the API saves the rows.</p><Button kind="primary" onClick={()=>setPage('imports')}><Upload size={15}/> Open Data & Imports</Button></div></>
}

function Forecasting() {
  const {setForecastAnalysis}=useData()
  const [tab,setTab,tabPhase,requestedTab]=useAnimatedValue('Demand')
  const [csvText,setCsvText]=useState('')
  const [fileName,setFileName]=useState('')
  const [buildings,setBuildings]=useState([])
  const [buildingId,setBuildingId]=useState('')
  const [timezone,setTimezone]=useState('Asia/Kolkata')
  const [horizon,setHorizon]=useState(24)
  const [tariff,setTariff]=useState(6)
  const [carbonIntensity,setCarbonIntensity]=useState(0.7)
  const [batteryCapacity,setBatteryCapacity]=useState(20)
  const [batterySocPercent,setBatterySocPercent]=useState(80)
  const [result,setResult]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  const loadCSV=async(text,name)=>{
    const parsed=parseCSV(text)
    const required=['timestamp','building_id','demand_kw','occupancy','solar_kw']
    const missing=required.filter(column=>!parsed.headers.includes(column))
    if(missing.length)throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`)
    const buildingIndex=parsed.headers.indexOf('building_id')
    const ids=[...new Set(parsed.rows.map(row=>row[buildingIndex].trim()).filter(Boolean))].sort()
    if(!ids.length)throw new Error('The CSV needs at least one non-empty building_id.')
    if(ids.length>10)throw new Error('The API supports up to 10 buildings per CSV.')
    setCsvText(text);setFileName(name);setBuildings(ids);setBuildingId(ids[0]);setResult(null);setError('');setNotice(`${parsed.rows.length.toLocaleString()} rows loaded. The backend will validate hourly coverage and train the models.`)
  }
  const chooseFile=async event=>{
    const file=event.target.files?.[0]
    if(!file)return
    setError('');setNotice('')
    try{
      if(file.size>5*1024*1024)throw new Error('Choose a CSV smaller than 5 MB.')
      await loadCSV(await file.text(),file.name)
    }catch(reason){setCsvText('');setFileName('');setBuildings([]);setBuildingId('');setResult(null);setError(reason?.message||'Could not read this CSV.')}
    finally{event.target.value=''}
  }
  const loadSample=async()=>{
    setError('');setNotice('Loading synthetic sample…')
    try{
      const response=await fetch(`${import.meta.env.BASE_URL}ai_ml_sample.csv`)
      if(!response.ok)throw new Error('Could not load the included demo CSV.')
      await loadCSV(await response.text(),'ai_ml_sample.csv')
      setNotice('Synthetic demo data loaded. It is not real campus telemetry.')
    }catch(reason){setError(reason?.message||'Could not load the demo CSV.');setNotice('')}
  }
  const run=async()=>{
    if(!csvText||!buildingId)return
    const tariffValue=Number(tariff),carbonValue=Number(carbonIntensity),capacityValue=Number(batteryCapacity),socValue=Number(batterySocPercent)
    if(!Number.isFinite(tariffValue)||tariffValue<0||!Number.isFinite(carbonValue)||carbonValue<0||!Number.isFinite(capacityValue)||capacityValue<=0||!Number.isFinite(socValue)||socValue<15||socValue>100){setError('Enter a non-negative tariff and carbon factor, positive battery capacity, and charge between 15% and 100%.');return}
    setLoading(true);setError('');setNotice('Training forecasts and evaluating the chronological holdout…')
    try{
      const forecastHorizon=Number(horizon)
      const capacity=Number(batteryCapacity)
      const recommendationInputs={
        price_per_kwh:Array(forecastHorizon).fill(tariffValue),
        carbon_kg_per_kwh:Array(forecastHorizon).fill(carbonValue),
        battery:{capacity_kwh:capacity,initial_soc_kwh:capacity*socValue/100,min_soc_kwh:capacity*.1,reserve_soc_kwh:capacity*.15,max_charge_kw:capacity/4,max_discharge_kw:capacity/4,charge_efficiency:.95,discharge_efficiency:.94,degradation_cost_per_kwh:.02},
        carbon_weight:1,
        step_hours:1,
        soc_steps:20
      }
      const analysis=await runForecastAnalysis({csv_text:csvText,building_id:buildingId,timezone,horizon:forecastHorizon,control_inputs:recommendationInputs,source_file:fileName})
      const integrated={...analysis,building_id:buildingId,source_file:fileName,settings:{tariff_per_kwh:tariffValue,carbon_kg_per_kwh:carbonValue,battery_capacity_kwh:capacity,battery_initial_soc_kwh:capacity*socValue/100}}
      setResult(integrated)
      setForecastAnalysis(integrated)
      setNotice(analysis.recommendation?'Backend forecast, anomaly flags and optimizer recommendation are ready.':'Forecast is ready, but no optimization recommendation came back.')
    }catch(reason){setResult(null);setError(reason?.name==='AbortError'?'The analysis took too long. Check that the backend is running and try again.':reason?.message||'Could not run the forecasting API.')}
    finally{setLoading(false)}
  }

  const fields={Demand:{key:'demand_kw',unit:'kW',icon:Zap},Occupancy:{key:'occupancy',unit:'people',icon:Building2},Solar:{key:'solar_kw',unit:'kW',icon:Sun}}
  const target=fields[tab]
  const score=result?.evaluation?.scores?.[buildingId]?.[target.key]?.model
  const forecastRows=result?.forecast||[]
  const axisLabels=forecastRows.map(row=>new Date(row.timestamp).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))
  const data={labels:axisLabels,datasets:[
    {label:'95th percentile',data:forecastRows.map(row=>row[`${target.key}_p95`]),borderColor:'#ab8b99',borderDash:[4,5],pointRadius:0,borderWidth:1.5,tension:.35},
    {label:'Median forecast',data:forecastRows.map(row=>row[`${target.key}_p50`]),borderColor:'#c9283e',backgroundColor:'rgba(201,40,62,.08)',fill:false,tension:.4,pointRadius:2,borderWidth:2.5},
    {label:'5th percentile',data:forecastRows.map(row=>row[`${target.key}_p05`]),borderColor:'#ab8b99',borderDash:[4,5],pointRadius:0,borderWidth:1.5,tension:.35}
  ]}
  const chartOptions={...lineOptions,plugins:{...lineOptions.plugins,legend:{display:true,position:'bottom'}},scales:{...lineOptions.scales,y:{...lineOptions.scales.y,ticks:{...lineOptions.scales.y.ticks,callback:value=>`${value} ${target.unit}`}}}}
  const next=forecastRows[0]
  const firstBand=next?`${Number(next[`${target.key}_p05`]).toFixed(1)}–${Number(next[`${target.key}_p95`]).toFixed(1)} ${target.unit}`:'—'
  const alerts=result?.alerts||[]
  const formatTime=value=>new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})

  return <>
    <SectionTitle eyebrow="PREDICTIVE INTELLIGENCE" title="AI Forecasting" desc="Upload hourly building history to get backend forecasts, holdout metrics and explainable anomaly flags." right={<Button kind="primary" disabled={!csvText||loading} onClick={run}><RefreshCw size={15}/>{loading?'Analyzing…':'Run backend forecast'}</Button>}/>
    <div className="panel forecast-input-panel">
      <div className="panel-head"><div><h3>Forecast input</h3><p>CSV analysis runs in the Eco-Pulse backend. Your file is sent only when you press Run backend forecast.</p></div><span className="pill info">Advisory only</span></div>
      <div className="forecast-input-grid">
        <div><label className="field-label" htmlFor="forecast-csv">Hourly CSV</label><label className="btn forecast-file-picker" htmlFor="forecast-csv"><Upload size={15}/>{fileName||'Choose forecasting CSV'}<input id="forecast-csv" type="file" accept=".csv,text/csv" onChange={chooseFile}/></label><small className="forecast-help">Required columns: timestamp, building_id, demand_kw, occupancy, solar_kw. Hourly rows for at least 35 days; timestamps must include a timezone.</small></div>
        <label><span className="field-label">Building</span><select value={buildingId} onChange={event=>{setBuildingId(event.target.value);setResult(null)}} disabled={!buildings.length}>{buildings.map(id=><option key={id} value={id}>{id}</option>)}</select></label>
        <label><span className="field-label">Forecast horizon</span><select value={horizon} onChange={event=>setHorizon(event.target.value)}><option value={12}>12 hours</option><option value={24}>24 hours</option><option value={48}>48 hours</option></select></label>
        <label><span className="field-label">Timezone</span><input value={timezone} onChange={event=>setTimezone(event.target.value)} aria-label="Forecast timezone" placeholder="Asia/Kolkata"/></label>
        <label><span className="field-label">Tariff (₹/kWh)</span><input type="number" min="0" step="0.1" value={tariff} onChange={event=>setTariff(event.target.value)}/></label>
        <label><span className="field-label">Grid carbon (kg CO₂e/kWh)</span><input type="number" min="0" step="0.01" value={carbonIntensity} onChange={event=>setCarbonIntensity(event.target.value)}/></label>
        <label><span className="field-label">Battery capacity (kWh)</span><input type="number" min="1" step="1" value={batteryCapacity} onChange={event=>setBatteryCapacity(event.target.value)}/></label>
        <label><span className="field-label">Current battery charge (%)</span><input type="number" min="15" max="100" step="1" value={batterySocPercent} onChange={event=>setBatterySocPercent(event.target.value)}/></label>
      </div>
      <small className="forecast-help">Enter your tariff, grid factor and battery nameplate values. The optimizer uses demand p95 and solar p05 for a conservative recommendation. No equipment is controlled.</small>
      <div className="forecast-input-actions"><Button onClick={loadSample} disabled={loading}><Zap size={14}/> Load synthetic demo data</Button><Button kind="primary" onClick={run} disabled={!csvText||loading}><Cpu size={14}/>{loading?'Training models…':'Run backend forecast'}</Button></div>
      {notice&&<p className="forecast-feedback" role="status">{notice}</p>}
      {error&&<div className="forecast-error" role="alert"><AlertTriangle size={17}/><div><b>Forecast request could not complete</b><p>{error}</p></div></div>}
    </div>
    {result&&<>
      <div className="optimization-banner"><div className="opt-icon"><Activity size={20}/></div><div><b>Forecast and optimization recommendation · {buildingId}</b><p>Demand p95 + solar p05 · {horizon}-hour horizon · tariff ₹{Number(tariff).toFixed(2)}/kWh · grid factor {Number(carbonIntensity).toFixed(2)} kg/kWh. Advisory only.</p></div><span className="pill success">{result.evaluation?.test_days||7}-day holdout</span></div>
      {result.recommendation&&<div className="import-source-note"><CheckCircle2 size={18}/><div><b>Optimization is using this forecast</b><p>The backend returned the forecast and battery schedule together. Open Energy Optimization to review the same recommendation.</p></div></div>}
      <div className="forecast-tabs">{Object.entries(fields).map(([name,field])=>{const Icon=field.icon;return <button onClick={()=>setTab(name)} aria-pressed={requestedTab===name} className={requestedTab===name?'active':''} key={name}><Icon size={16}/> {name} forecast</button>})}</div>
      <div className="content-grid motion-frame" data-motion={tabPhase} data-view={String(tab)} key={tab}>
        <div className="panel forecast-chart-panel"><div className="panel-head"><div><h3>{tab} forecast · Next {horizon} hours</h3><p>Backend median with 5th–95th percentile prediction bounds</p></div><span className="pill success">{score?.interval_coverage_pct==null?'Interval metrics':`${Number(score.interval_coverage_pct).toFixed(1)}% holdout coverage`}</span></div><div className="forecast-chart"><Line data={data} options={chartOptions}/></div>
          <div className="forecast-stats"><div><span>Next-hour median</span><b>{next?`${Number(next[`${target.key}_p50`]).toFixed(1)} ${target.unit}`:'—'}</b></div><div><span>Next-hour 90% range</span><b>{firstBand}</b></div><div><span>Holdout MAE</span><b>{score?`${Number(score.mae).toFixed(2)} ${target.unit}`:'—'}</b></div></div>
        </div>
        <div className="panel model-panel"><h3>Chronological holdout</h3><p className="panel-sub">Measured from the uploaded history · {result.evaluation?.method}</p>{Object.entries(fields).map(([name,field])=>{const item=result.evaluation?.scores?.[buildingId]?.[field.key]?.model;return <div className="model-row" key={name}><div><b>{name}</b><small>MAE {item?Number(item.mae).toFixed(2):'—'} {field.unit} · RMSE {item?Number(item.rmse).toFixed(2):'—'} {field.unit}</small></div><strong>{item?.interval_coverage_pct==null?'—':`${Number(item.interval_coverage_pct).toFixed(0)}%`}</strong></div>})}<div className="safe-note"><ShieldCheck size={17}/><span>Historical holdout metrics describe this file only; they are not a guarantee of future accuracy.</span></div></div>
      </div>
      <div className="panel"><div className="panel-head"><div><h3>Explainable anomaly flags</h3><p>{alerts.length} flagged reading{alerts.length===1?'':'s'} from the analyzed history</p></div><span className={`pill ${alerts.length?'warning':'success'}`}>{alerts.length?'Review needed':'No flags'}</span></div>
        {alerts.length?alerts.slice(0,50).map((alert,index)=><div className="anomaly-row" key={`${alert.timestamp}-${alert.signal}-${index}`}><div className="anomaly-icon medium"><AlertTriangle size={16}/></div><div className="anomaly-name"><b>{alert.signal} · {alert.reason.replaceAll('_',' ')}</b><small>{alert.building_id} · {formatTime(alert.timestamp)}</small></div><span className="pill warning">{alert.severity}</span><span className="anomaly-time">Value {Number(alert.value).toFixed(1)} · expected {alert.expected==null?'—':Number(alert.expected).toFixed(1)}</span><span className="anomaly-time">Score {alert.score==null?'—':Number(alert.score).toFixed(1)}</span></div>):<div className="forecast-empty">No anomaly flags were returned for the analyzed readings.</div>}
        {alerts.length>50&&<small className="forecast-help">Showing the first 50 of {alerts.length} flags.</small>}
      </div>
    </>}
    {!result&&!loading&&<div className="note-panel"><ShieldCheck size={19}/><div><b>Forecasts are advisory estimates</b><p>Try the clearly labelled synthetic sample or upload at least 35 days of hourly demand, occupancy and solar history. This dashboard sends the CSV to the backend only after you run the analysis.</p></div></div>}
  </>
}

function Optimization() {
  const {forecastAnalysis}=useData()
  const forecastRecommendation=forecastAnalysis?.recommendation
  const [result,setResult]=useState(forecastRecommendation||null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{setResult(forecastRecommendation||null)},[forecastRecommendation])
  const run=async()=>{
    if(forecastRecommendation){setResult(forecastRecommendation);return}
    setLoading(true);setError('')
    try { setResult(await runScheduleRecommendation()) }
    catch (reason) { setResult(null);setError(reason?.name==='AbortError'?'The backend took too long to respond. Check that it is running.':reason?.message||'Could not reach the optimization API.') }
    finally { setLoading(false) }
  }
  const metrics=result?.metrics
  const safeConstraints=forecastRecommendation?[
    ['Critical-load profile','Not supplied','Not configured'],
    ['HVAC minimum','Not supplied','Not configured'],
    ['Battery reserve',`${Number(forecastAnalysis.settings.battery_capacity_kwh*.15).toFixed(1)} kWh`,'Applied'],
    ['Grid import limit','Not supplied','Not configured'],
    ['Equipment switching','Recommendation only','Disabled']
  ]:[['Critical loads','Prioritized in sample profile','Protected'],['HVAC minimum','Included in sample request','Enforced'],['Battery reserve','3 kWh sample','Protected'],['Grid import limit','3 kW sample','Applied'],['Equipment switching','Recommendation only','Disabled']]
  const money=value=>typeof value==='number'?'₹'+Math.round(value).toLocaleString('en-IN'):'—'
  const number=value=>typeof value==='number'?value.toFixed(2):'—'
  return <>
    <SectionTitle eyebrow="INTELLIGENT CONTROL" title="Energy Optimization" desc={forecastRecommendation?`Recommendation generated from ${forecastAnalysis.building_id}'s latest backend forecast.`:'No campus forecast is connected yet. Generate one first, or run the clearly labelled sample profile.'} right={<Button kind="primary" disabled={loading} onClick={run}><Cpu size={15}/>{loading?'Requesting API…':forecastRecommendation?'Use latest forecast schedule':'Run sample optimization'}</Button>}/>
    <div className="optimization-banner"><div className="opt-icon"><SlidersHorizontal size={21}/></div><div><b>{result?(forecastRecommendation?'Forecast-based recommendation received':'Sample backend recommendation received'):'Recommendation-only controller'}</b><p>{forecastRecommendation?'Uses demand p95, solar p05 and the tariff, grid factor and battery settings entered in AI Forecasting.':result?'This schedule came from the backend using the labelled demo profile. It does not control equipment.':'Run AI Forecasting to connect a campus forecast, or run the labelled sample profile.'}</p></div><span className="pill success"><span className="live-dot"/> Human approval required</span></div>
    {error&&<div className="note-panel" role="alert"><AlertTriangle size={19}/><div><b>Optimization request failed</b><p>{error}</p></div></div>}
    <div className="metric-grid three"><Metric label="Estimated cost savings" value={money(metrics?.estimated_cost_savings)} change={metrics?'Backend result':'Run the backend API'} note={forecastRecommendation?`${forecastAnalysis.forecast.length}-hour forecast`:'4-interval sample'} icon={TrendingDown}/><Metric label="Estimated carbon savings" value={number(metrics?.estimated_carbon_savings_kg)} unit={metrics?' kg CO₂e':''} change={metrics?'Backend result':'Run the backend API'} note={forecastRecommendation?'Forecast-based scenario':'4-interval sample'} icon={Leaf}/><Metric label="Peak demand reduction" value={number(metrics?.estimated_peak_reduction_kw)} unit={metrics?' kW':''} change={metrics?'Backend result':'Run the backend API'} note={forecastRecommendation?'Forecast-based scenario':'4-interval sample'} icon={Gauge}/></div>
    <div className="content-grid"><div className="panel"><div className="panel-head"><div><h3>Recommended control schedule</h3><p>{result?'Live response from the optimization endpoint':'No API result yet'}</p></div><span className="pill info">Advisory only</span></div>
      {result?.schedule?.map(step=>{const charge=(step.battery_charge_from_grid_kwh||0)+(step.battery_charge_from_solar_kwh||0);const discharge=step.battery_discharge_kwh||0;const action=charge>0.01?'Charge battery':discharge>0.01?'Discharge battery':'Hold battery';return <div className="dispatch-row" key={step.step}><div className={`dispatch-icon ${charge>0.01?'charge':''}`}><BatteryCharging size={17}/></div><div><b>Interval {Number(step.step)+1} · {action}</b><small>Grid import {number(step.grid_import_kwh)} kWh · battery SOC {number(step.battery_soc_kwh)} kWh · flexible load shed {number(step.flexible_load_shed_kwh)} kWh</small></div><strong>{number(step.renewable_used_kwh)} kWh solar</strong></div>})}
      {!result&&<div className="safe-note"><ShieldCheck size={17}/><span>The values shown elsewhere in the dashboard are illustrative. Run the backend optimization to display its actual returned schedule here.</span></div>}
      {result&&<div className="safe-note"><ShieldCheck size={17}/><span>{result.requires_human_approval?'Human review is required. ':''}No equipment is automatically switched. Mode: {result.mode}.</span></div>}
    </div><div className="panel constraints-panel"><h3>Safety constraints</h3><p className="panel-sub">{forecastRecommendation?'Based on the limits actually sent with this forecast':'Limits in the labelled sample API request'}</p>{safeConstraints.map(row=><div className="constraint" key={row[0]}><div><b>{row[0]}</b><small>{row[1]}</small></div><span><CheckCircle2 size={14}/>{row[2]}</span></div>)}<div className="safe-note"><ShieldCheck size={17}/><span>Review the schedule before any separate, authorized control system uses it.</span></div></div></div>
  </>
}

function Battery({setPage}) {
  const {forecastAnalysis,assetTelemetry}=useData()
  const batteryReadings=assetTelemetry.filter(reading=>reading.asset_type==='battery')
  const latestMetric=(rows,metric)=>rows.find(reading=>reading.metric===metric)
  const liveSoc=latestMetric(batteryReadings,'state_of_charge_pct')
  const liveCapacity=latestMetric(batteryReadings,'capacity_kwh')
  const liveHealth=latestMetric(batteryReadings,'health_pct')
  const recommendation=forecastAnalysis?.recommendation
  const capacity=forecastAnalysis?.settings?.battery_capacity_kwh
  const initial=forecastAnalysis?.settings?.battery_initial_soc_kwh
  const last= recommendation?.schedule?.at(-1)?.battery_soc_kwh
  const schedule=recommendation?.schedule||[]
  const pct=(value)=>capacity&&Number.isFinite(Number(value))?Math.round(Number(value)/capacity*100):null
  return <><SectionTitle eyebrow="ENERGY STORAGE" title="Battery & Storage" desc={batteryReadings.length?'Latest battery values from the normalized asset telemetry feed; schedule remains advisory.':'No live BMS feed is connected. Forecast model values below are assumptions, not measured battery status.'} right={<Button kind="primary" onClick={()=>setPage('forecasting')}><Activity size={15}/> Configure forecast</Button>}/>{batteryReadings.length?<div className="metric-grid three"><Metric label="Live state of charge" value={liveSoc?Number(liveSoc.value).toFixed(1):'—'} unit={liveSoc?'%':''} change={liveSoc?new Date(liveSoc.timestamp).toLocaleString():'Not reported'} note={liveSoc?.asset_id||'BMS metric missing'} icon={BatteryCharging}/><Metric label="Battery capacity" value={liveCapacity?Number(liveCapacity.value).toFixed(1):'—'} unit={liveCapacity?` ${liveCapacity.unit}`:''} change={liveCapacity?'Latest BMS value':'Not reported'} note={liveCapacity?.asset_id||'BMS metric missing'} icon={Gauge}/><Metric label="Battery health" value={liveHealth?Number(liveHealth.value).toFixed(1):'—'} unit={liveHealth?'%':''} change={liveHealth?'Latest BMS value':'Not reported'} note={liveHealth?.asset_id||'BMS metric missing'} icon={ShieldCheck}/></div>:capacity?<><div className="metric-grid three"><Metric label="Configured capacity" value={capacity} unit=" kWh" change="Forecast model input" note="not measured telemetry" icon={BatteryCharging}/><Metric label="Initial state of charge" value={pct(initial)??'—'} unit="%" change="Forecast model input" note={`${initial} kWh assumed`} icon={Gauge}/><Metric label="Final scheduled charge" value={pct(last)??'—'} unit="%" change="Optimizer result" note={last==null?'No schedule returned':`${Number(last).toFixed(2)} kWh`} icon={Zap}/></div><div className="panel"><div className="panel-head"><div><h3>Backend dispatch schedule</h3><p>Recommendation for {forecastAnalysis.building_id}; advisory only</p></div></div>{schedule.length?schedule.map(step=><div className="dispatch-row" key={step.step}><div className="dispatch-icon"><BatteryCharging size={17}/></div><div><b>Interval {Number(step.step)+1}</b><small>Charge solar {Number(step.battery_charge_from_solar_kwh||0).toFixed(2)} kWh · grid {Number(step.battery_charge_from_grid_kwh||0).toFixed(2)} kWh · discharge {Number(step.battery_discharge_kwh||0).toFixed(2)} kWh</small></div><strong>{Number(step.battery_soc_kwh||0).toFixed(2)} kWh SOC</strong></div>):<p className="forecast-empty">Forecast exists but the API returned no battery schedule.</p>}</div></>:<div className="panel forecast-empty"><BatteryCharging size={22}/><h3>No battery data configured</h3><p>Run AI Forecasting to create a schedule, or send measured battery telemetry to the API before expecting live status.</p><Button kind="primary" onClick={()=>setPage('forecasting')}>Open AI Forecasting</Button></div>}<div className="safe-note"><ShieldCheck size={17}/><span>Battery temperature, state of health and device connectivity only appear when the BMS sends them. Eco-Pulse does not switch equipment.</span></div></>
}

function HVAC({setPage}) {
  const {dataset,assetTelemetry}=useData()
  const readings=assetTelemetry.filter(reading=>reading.asset_type==='hvac')
  const byAsset=[...readings.reduce((map,reading)=>{const item=map.get(reading.asset_id)||{building:reading.building_id,metrics:{},timestamp:reading.timestamp};if(!item.metrics[reading.metric])item.metrics[reading.metric]=reading;map.set(reading.asset_id,item);return map},new Map())]
  return <><SectionTitle eyebrow="BUILDING COMFORT" title="HVAC Management" desc="Read-only HVAC telemetry from the normalized asset feed. This dashboard does not send setpoint commands."/><div className="panel"><div className="panel-head"><div><h3>Reported HVAC zones</h3><p>Latest submitted telemetry per asset</p></div><span className={`pill ${readings.length?'success':'info'}`}>{readings.length?`${byAsset.length} assets reported`:'No feed'}</span></div>{byAsset.length?byAsset.map(([asset,zone])=><div className="zone-row" key={asset}><div className="zone-symbol"><Snowflake size={17}/></div><div className="zone-name"><b>{asset}</b><small>{zone.building} · {new Date(zone.timestamp).toLocaleString()}</small></div><div className="zone-temp">{zone.metrics.indoor_temperature_c?`${Number(zone.metrics.indoor_temperature_c.value).toFixed(1)}°C`:'—'}</div><span className="pill info">{zone.metrics.hvac_power_kw?`${Number(zone.metrics.hvac_power_kw.value).toFixed(1)} kW`:'No power metric'}</span></div>):<div className="forecast-empty"><h3>No HVAC zone telemetry connected</h3><p>{dataset?`${dataset.rows.length.toLocaleString()} energy readings are available, but do not contain indoor temperatures or equipment state.`:'No campus readings are available yet.'} Send sensor readings to <code>POST /api/energy/telemetry/batch</code> to populate this screen.</p><Button kind="primary" onClick={()=>setPage('imports')}><Upload size={15}/> Open Data & Imports</Button></div>}</div><div className="safe-note"><ShieldCheck size={17}/><span>Live sensor data is informational only. Do not treat this page as an approved HVAC control system.</span></div></>
}

function Loads({setPage}) {
  const {dataset,forecastAnalysis}=useData()
  const rows=dataset?.rows||[]
  const grouped=rows.reduce((acc,row)=>{const item=acc.get(row.building)||{count:0,energy:0,occupancy:0,occupancyCount:0};item.count++;item.energy+=Number(row.consumption_kwh)||0;if(row.occupancy!=null){item.occupancy+=Number(row.occupancy)||0;item.occupancyCount++}acc.set(row.building,item);return acc},new Map())
  const recommendation=forecastAnalysis?.recommendation
  return <><SectionTitle eyebrow="LOAD MANAGEMENT" title="Smart Loads" desc="Recorded building energy and occupancy, plus forecast-based recommendations where available. Equipment priorities are not configured in this project." right={<Button onClick={()=>setPage('imports')}><Upload size={15}/> Import readings</Button>}/>{!rows.length?<div className="panel forecast-empty"><PlugZap size={22}/><h3>No building readings</h3><p>Import energy and optional occupancy readings to populate this view.</p></div>:<><div className="metric-grid three"><Metric label="Buildings in readings" value={grouped.size} change="Shared backend dataset" note={`${rows.length.toLocaleString()} intervals`} icon={Building2}/><Metric label="Recorded energy" value={rows.reduce((sum,row)=>sum+(Number(row.consumption_kwh)||0),0).toFixed(1)} unit=" kWh" change="Imported period" note="meter values" icon={Zap}/><Metric label="Buildings with occupancy" value={[...grouped.values()].filter(x=>x.occupancyCount).length} change="Column supplied" note="not device telemetry" icon={Activity}/></div><div className="panel"><h3>Building load register</h3><p className="panel-sub">Aggregated imported records · load priority classification is not yet set</p><div className="load-table"><div className="load-row head"><span>BUILDING</span><span>INTERVALS</span><span>ENERGY</span><span>AVG OCCUPANCY</span><span>OPTIMIZER</span></div>{[...grouped].map(([building,item])=><div className="load-row" key={building}><b>{building}</b><span>{item.count}</span><strong>{item.energy.toFixed(2)} kWh</strong><span>{item.occupancyCount?(item.occupancy/item.occupancyCount).toFixed(1):'—'}</span><span className="pill info">{recommendation?'See forecast schedule':'Not configured'}</span></div>)}</div></div>{recommendation&&<div className="panel"><h3>Forecast dispatch recommendation</h3>{recommendation.schedule?.map(step=><div className="dispatch-row" key={step.step}><div className="dispatch-icon"><PlugZap size={17}/></div><div><b>Interval {Number(step.step)+1}</b><small>Flexible load shed recommendation {Number(step.flexible_load_shed_kwh||0).toFixed(2)} kWh</small></div><strong>Advisory</strong></div>)}</div>}</>}</>
}

function Carbon({setPage}) {
  const {dataset,forecastAnalysis}=useData()
  const rows=dataset?.rows||[]
  const hasCarbon=rows.some(row=>row.carbon_kg!==null&&row.carbon_kg!==undefined&&Number.isFinite(Number(row.carbon_kg)))
  const hasGrid=rows.some(row=>row.grid_import_kwh!==null&&row.grid_import_kwh!==undefined&&Number.isFinite(Number(row.grid_import_kwh)))
  const carbon=rows.reduce((sum,row)=>sum+(Number(row.carbon_kg)||0),0)
  const grid=rows.reduce((sum,row)=>sum+(Number(row.grid_import_kwh)||0),0)
  const solar=rows.reduce((sum,row)=>sum+(Number(row.solar_used_kwh)||0),0)
  const energy=rows.reduce((sum,row)=>sum+(Number(row.consumption_kwh)||0),0)
  const intensity=hasGrid&&hasCarbon&&grid?carbon/grid*1000:null
  const chartRows=[...rows].reverse().slice(-48)
  const bars={labels:chartRows.map(row=>new Date(row.timestamp).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit'})),datasets:[{label:'Recorded CO₂e',data:chartRows.map(row=>row.carbon_kg),backgroundColor:'#c9283e',borderRadius:5}]}
  const recommendation=forecastAnalysis?.recommendation
  return <><SectionTitle eyebrow="SUSTAINABILITY INTELLIGENCE" title="Carbon Intelligence" desc="Recorded carbon and grid values from the shared readings; no live grid carbon-intensity feed is connected." right={<Button onClick={()=>setPage('imports')}><Upload size={15}/> Import readings</Button>}/>{rows.length?<><div className="metric-grid three"><Metric label="Recorded grid carbon" value={hasCarbon?carbon.toFixed(2):'—'} unit={hasCarbon?' kg CO₂e':''} change={`${rows.length} readings`} note="imported period" icon={Leaf}/><Metric label="Recorded grid intensity" value={intensity===null?'—':intensity.toFixed(1)} unit={intensity===null?'':' gCO₂e/kWh'} change={intensity===null?'Grid/carbon columns incomplete':'Derived from recorded carbon / grid import'} note="not a live grid signal" icon={Gauge}/><Metric label="Solar share of consumption" value={energy?(solar/energy*100).toFixed(1):'—'} unit={energy?'%':''} change={`${solar.toFixed(2)} kWh recorded solar`} note="of consumption" icon={Sun}/></div><div className="content-grid"><div className="panel"><div className="panel-head"><div><h3>Recorded emissions by interval</h3><p>Imported readings · kg CO₂e</p></div></div><div className="forecast-chart"><Bar data={bars} options={{...lineOptions,plugins:{legend:{display:false}},scales:{...lineOptions.scales,y:{...lineOptions.scales.y,ticks:{...lineOptions.scales.y.ticks,callback:v=>v+' kg'}}}}}/></div></div><div className="panel"><h3>Forecast carbon-aware schedule</h3><p className="panel-sub">Backend advisory from latest forecast</p>{recommendation?.schedule?.length?recommendation.schedule.map(step=><div className="report-row" key={step.step}><span>Interval {Number(step.step)+1}</span><b>{Number(step.grid_import_kwh||0).toFixed(2)} kWh grid</b><span className="pill info">Advisory</span></div>):<p className="forecast-empty">Run AI Forecasting with a grid carbon factor to produce an advisory schedule.</p>}</div></div><div className="import-source-note"><Database size={18}/><div><b>Values are from imported readings</b><p>Carbon totals are reported only when a carbon column was supplied. Avoided emissions and time-of-use recommendations require a validated baseline and grid signal.</p></div></div></>:<div className="panel forecast-empty"><Leaf size={22}/><h3>No carbon readings available</h3><p>Import records with grid import and carbon columns to populate this page. You can also enter a grid factor in AI Forecasting for a clearly labelled recommendation.</p><Button kind="primary" onClick={()=>setPage('imports')}>Open Data & Imports</Button></div>}</>
}

function Twin({setPage}) {
  const {dataset,forecastAnalysis}=useData()
  const rows=dataset?.rows||[]
  const hasCost=rows.some(row=>row.cost_inr!==null&&row.cost_inr!==undefined&&Number.isFinite(Number(row.cost_inr)))
  const hasCarbon=rows.some(row=>row.carbon_kg!==null&&row.carbon_kg!==undefined&&Number.isFinite(Number(row.carbon_kg)))
  const buildings=[...rows.reduce((map,row)=>{const item=map.get(row.building)||{energy:0,count:0};item.energy+=Number(row.consumption_kwh)||0;item.count++;map.set(row.building,item);return map},new Map())]
  const total=rows.reduce((sum,row)=>sum+(Number(row.consumption_kwh)||0),0)
  const grid=rows.reduce((sum,row)=>sum+(Number(row.grid_import_kwh)||0),0)
  const carbon=rows.reduce((sum,row)=>sum+(Number(row.carbon_kg)||0),0)
  return <><SectionTitle eyebrow="VIRTUAL ENERGY SYSTEM" title="Digital Twin" desc="A building-level view built from readings stored in the shared backend; no live asset model is connected." right={<Button onClick={()=>setPage('imports')}><Upload size={15}/> Import readings</Button>}/>{rows.length?<><div className="metric-grid three"><Metric label="Buildings represented" value={buildings.length} change="Imported building IDs" note={`${rows.length} records`} icon={Building2}/><Metric label="Recorded energy" value={total.toFixed(2)} unit=" kWh" change="Imported period" note="not real-time" icon={Zap}/><Metric label="Recorded grid import" value={grid.toFixed(2)} unit=" kWh" change={grid?'Shared backend values':'Column not supplied'} note="imported period" icon={PlugZap}/></div><div className="content-grid"><div className="panel"><h3>Building energy map</h3><p className="panel-sub">Totals calculated from stored meter readings</p>{buildings.map(([name,item])=><div className="report-row" key={name}><span><Building2 size={15}/> {name}</span><b>{item.energy.toFixed(2)} kWh</b><span>{item.count} intervals</span></div>)}</div><div className="panel"><h3>Recorded campus footprint</h3><p className="panel-sub">Imported period totals</p><div className="scenario-total"><span>Consumption</span><b>{total.toFixed(2)} <small>kWh</small></b></div><div className="scenario-total"><span>Grid import</span><b>{grid.toFixed(2)} <small>kWh</small></b></div><div className="scenario-total"><span>Carbon recorded</span><b>{carbon.toFixed(2)} <small>kg CO₂e</small></b></div><div className="safe-note"><Database size={17}/><span>These are historical readings, not live telemetry. No baseline-vs-optimized comparison is claimed.</span></div>{forecastAnalysis?.recommendation&&<Button kind="primary" onClick={()=>setPage('optimization')}>Review latest advisory schedule</Button>}</div></div></>:<div className="panel forecast-empty"><Building2 size={22}/><h3>No campus readings to map</h3><p>Import energy readings to build the digital twin summary by building.</p><Button kind="primary" onClick={()=>setPage('imports')}>Open Data & Imports</Button></div>}</>
}
function Outage({setOutage}) {
  const [active,setActive]=useState(false)
  const [duration,setDuration]=useState(4)
  const [result,setResult]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const run=async()=>{
    if(active){setResult(null);setActive(false);setOutage(false);return}
    setLoading(true);setError('')
    try { setResult(await runOutageSimulation(duration));setActive(true);setOutage(true) }
    catch (reason) { setResult(null);setActive(false);setOutage(false);setError(reason?.name==='AbortError'?'The backend took too long to respond. Check that it is running.':reason?.message||'Could not reach the outage API.') }
    finally { setLoading(false) }
  }
  const total=(result?.steps||[]).reduce((sum,step)=>sum+step.critical_load_kwh,0)
  const served=(result?.steps||[]).reduce((sum,step)=>sum+step.critical_load_served_kwh,0)
  const socPercent=result?Math.round((result.battery_final_soc_kwh/20)*100):null
  const violations=result?.critical_load_violations
  return <>
    <SectionTitle eyebrow="RESILIENCE & CONTINUITY" title="Outage Simulation" desc="Call the Eco-Pulse backend to simulate critical-load backup. This is a simulation only." right={<span className={`pill ${active?'warning':'success'}`}>{active?'Simulation complete':'Grid connected'}</span>}/>
    <div className={`outage-status ${active?'islanded':''}`}><div className="outage-status-icon"><Power size={22}/></div><div><b>{active?'Backend outage simulation complete':'No outage simulation run'}</b><p>{active?'The backend estimated backup duration and reported any critical-load shortfall. No physical switching occurred.':'Choose a duration and run the backend simulation to see its estimate.'}</p></div><Button kind={active?'secondary':'danger'} disabled={loading} onClick={run}>{loading?'Contacting backend…':active?'Clear result':'Run outage API simulation'}</Button></div>
    {error&&<div className="note-panel" role="alert"><AlertTriangle size={19}/><div><b>Outage request failed</b><p>{error}</p></div></div>}
    <div className="metric-grid three"><Metric label="Battery final state" value={socPercent===null?'—':String(socPercent)} unit={socPercent===null?'':'%'} change={result?'Backend result':'Run the backend API'} note="20 kWh demo battery" icon={BatteryCharging}/><Metric label="Critical load served" value={result?served.toFixed(1):'—'} unit={result?' kWh':''} change={result?violations+' shortfall intervals':'Run the backend API'} note={result?'of '+total.toFixed(1)+' kWh requested':'Demo profile'} icon={ShieldCheck}/><Metric label="Estimated backup duration" value={result?result.backup_duration_hours.toFixed(2):'—'} unit={result?' hours':''} change={result?'Backend result':'Run the backend API'} note="simulation estimate" icon={Activity}/></div>
    <div className="content-grid"><div className="panel"><h3>Critical-load continuity</h3><p className="panel-sub">Illustrative circuits; not readings from real equipment</p>{[['Emergency lighting','42 kW'],['Server & network room','68 kW'],['Medical / safety systems','35 kW']].map(row=><div className="critical-row" key={row[0]}><div><ShieldCheck size={16}/><b>{row[0]}</b></div><strong>{row[1]}</strong><span className="pill info">Sample</span></div>)}{result&&<div className={violations?'outage-status islanded':'safe-note'} role="status"><AlertTriangle size={17}/><span>{violations?violations+' interval(s) had a critical-load shortfall in this scenario.':'No critical-load shortfall in the simulated intervals.'} This is not a real facility assessment.</span></div>}<div className="safe-note"><ShieldCheck size={17}/><span>Simulation results are advisory. Real transfer switching requires certified protection and authorized operators.</span></div></div>
    <div className="panel"><h3>Scenario parameters</h3><p className="panel-sub">Demo profile sent to POST /api/optimization/outage</p><label className="field-label" htmlFor="outage-duration">Outage duration</label><select id="outage-duration" value={duration} onChange={event=>setDuration(Number(event.target.value))} disabled={loading}><option value="2">2 hours</option><option value="4">4 hours</option><option value="6">6 hours</option><option value="8">8 hours</option></select><div className="duration-result"><span>Simulation inputs</span><b>2 kWh critical load / interval</b><small>20 kWh battery · 16 kWh initial charge · renewable profile included</small></div><div className="safe-note"><AlertTriangle size={17}/><span>These are sample inputs for demonstrating the API, not campus telemetry.</span></div></div></div>
  </>
}

function Anomalies({setPage}) {
  const {forecastAnalysis}=useData()
  const alerts=forecastAnalysis?.alerts||[]
  const formatTime=value=>new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
  return <><SectionTitle eyebrow="SYSTEM HEALTH" title="Anomaly Detection" desc="Explainable anomaly flags returned by the latest AI Forecasting run." right={<Button kind="primary" onClick={()=>setPage('forecasting')}><Activity size={15}/> Analyze readings</Button>}/>{forecastAnalysis?<><div className="metric-grid three"><Metric label="Flagged readings" value={alerts.length} change="Backend analysis" note={forecastAnalysis.building_id} icon={AlertTriangle} positive={!alerts.length} tint={alerts.length?'amber':'green'}/><Metric label="Analyzed file" value={forecastAnalysis.source_file||'CSV'} change="Forecast input" note="not continuous monitoring" icon={Database}/><Metric label="Forecast holdout" value={forecastAnalysis.evaluation?.test_days||'—'} unit={forecastAnalysis.evaluation?.test_days?' days':''} change="Historical evaluation" note="file-specific" icon={ShieldCheck}/></div><div className="panel"><div className="panel-head"><div><h3>Backend anomaly flags</h3><p>{alerts.length} flagged readings · {forecastAnalysis.building_id}</p></div><span className={`pill ${alerts.length?'warning':'success'}`}>{alerts.length?'Review flags':'No flags returned'}</span></div>{alerts.length?alerts.map((alert,index)=><div className="anomaly-row" key={`${alert.timestamp}-${alert.signal}-${index}`}><div className="anomaly-icon medium"><AlertTriangle size={17}/></div><div className="anomaly-name"><b>{alert.signal} · {String(alert.reason).replaceAll('_',' ')}</b><small>{alert.building_id} · {formatTime(alert.timestamp)}</small></div><span className="pill warning">{alert.severity}</span><span className="anomaly-time">Value {Number(alert.value).toFixed(1)} · expected {alert.expected==null?'—':Number(alert.expected).toFixed(1)}</span></div>):<p className="forecast-empty">The backend returned no anomaly flags for this analyzed file.</p>}</div></>:<div className="panel forecast-empty"><AlertTriangle size={22}/><h3>No analysis has run yet</h3><p>Upload hourly history in AI Forecasting. This screen will show only the flags returned by the backend, rather than simulated alerts.</p><Button kind="primary" onClick={()=>setPage('forecasting')}>Open AI Forecasting</Button></div>}</>
}

function Reports({setPage}) {
  const {dataset,forecastAnalysis}=useData()
  const rows=dataset?.rows||[]
  const hasCost=rows.some(row=>row.cost_inr!==null&&row.cost_inr!==undefined&&Number.isFinite(Number(row.cost_inr)))
  const hasCarbon=rows.some(row=>row.carbon_kg!==null&&row.carbon_kg!==undefined&&Number.isFinite(Number(row.carbon_kg)))
  const consumption=rows.reduce((sum,row)=>sum+(Number(row.consumption_kwh)||0),0)
  const solar=rows.reduce((sum,row)=>sum+(Number(row.solar_used_kwh)||0),0)
  const grid=rows.reduce((sum,row)=>sum+(Number(row.grid_import_kwh)||0),0)
  const cost=rows.reduce((sum,row)=>sum+(Number(row.cost_inr)||0),0)
  const carbon=rows.reduce((sum,row)=>sum+(Number(row.carbon_kg)||0),0)
  const grouped=rows.reduce((map,row)=>{map.set(row.building,(map.get(row.building)||0)+(Number(row.consumption_kwh)||0));return map},new Map())
  const mae=forecastAnalysis?.evaluation?.scores?.[forecastAnalysis.building_id]?.demand_kw?.model?.mae
  const report=()=>{
    const lines=[['Eco-Pulse recorded energy report'],['Readings',rows.length],['Buildings',grouped.size],['Consumption kWh',consumption.toFixed(2)],['Solar used kWh',solar.toFixed(2)],['Grid import kWh',grid.toFixed(2)],['Recorded cost INR',cost.toFixed(2)],['Recorded carbon kg CO2e',carbon.toFixed(2)],['Forecast holdout MAE kW',mae??'Not available']]
    const csv=lines.map(line=>line.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n')
    const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));link.download='ecopulse-recorded-report.csv';link.click();URL.revokeObjectURL(link.href)
  }
  return <><SectionTitle eyebrow="PERFORMANCE & INSIGHTS" title="Reports & Metrics" desc="Export recorded values and forecast holdout metrics from this session." right={<Button kind="primary" onClick={report} disabled={!rows.length}><Download size={15}/> Export CSV</Button>}/>{rows.length?<><div className="report-toolbar"><span>Period in report</span><b>{dataset.name} · {rows.length.toLocaleString()} readings</b><span className="muted">No savings comparison without a validated baseline</span></div><div className="metric-grid"><Metric label="Recorded consumption" value={consumption.toFixed(2)} unit=" kWh" change="Imported period" note={`${grouped.size} buildings`} icon={Zap}/><Metric label="Recorded energy cost" value={hasCost?`₹${cost.toFixed(2)}`:'—'} change={hasCost?'Imported tariff totals':'Cost column not supplied'} note="not estimated savings" icon={TrendingDown}/><Metric label="Recorded CO₂e" value={hasCarbon?carbon.toFixed(2):'—'} unit={hasCarbon?' kg':''} change={hasCarbon?'Imported period':'Carbon column not supplied'} note="not avoided emissions" icon={Leaf}/><Metric label="Solar share" value={consumption?(solar/consumption*100).toFixed(1):'—'} unit={consumption?'%':''} change={`${grid.toFixed(2)} kWh recorded grid import`} note="of consumption" icon={Sun}/></div><div className="content-grid"><div className="panel"><h3>Energy by building</h3><p className="panel-sub">Recorded totals for the imported period</p>{[...grouped].map(([building,kwh])=><div className="report-row" key={building}><span>{building}</span><b>{kwh.toFixed(2)} kWh</b></div>)}</div><div className="panel"><h3>Model evaluation</h3><p className="panel-sub">Latest backend forecasting holdout, when available</p>{mae==null?<p className="forecast-empty">No forecast evaluation is available in this session.</p>:<div className="report-row"><span>Demand forecast MAE</span><b>{Number(mae).toFixed(2)} kW</b><span>Uploaded-file holdout only</span></div>}<div className="safe-note"><CircleHelp size={17}/><span>Cost and carbon are imported recorded values. This report does not infer savings, live conditions or equipment performance.</span></div></div></div></>:<div className="panel forecast-empty"><Download size={22}/><h3>No report data yet</h3><p>Import readings to create a CSV report. You can run forecasting separately to add an evaluation metric.</p><Button kind="primary" onClick={()=>setPage('imports')}>Open Data & Imports</Button></div>}</>
}
const pageInfo={imports:['Data & Imports','Your campus records'],overview:['Overview','Your campus at a glance'],forecasting:['AI Forecasting','Predictions & uncertainty'],optimization:['Energy Optimization','Intelligent control'],twin:['Digital Twin','Virtual campus'],battery:['Battery & Storage','Energy storage'],hvac:['HVAC Management','Comfort-aware climate'],loads:['Smart Loads','Flexible demand'],carbon:['Carbon Intelligence','Emissions & grid signals'],outage:['Outage Simulation','Resilience testing'],anomalies:['Anomaly Detection','System monitoring'],reports:['Reports','Performance metrics']}

export default function App() {
  const [page,setPage,pagePhase,requestedPage]=useAnimatedValue('overview')
  const [outage,setOutage]=useState(false)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.querySelector('.section-title h1')?.focus({ preventScroll: true })
  }, [page])
  const info=pageInfo[page]||pageInfo.overview
  const content=useMemo(()=>{
    switch(page){
      case 'imports':return <DataImport setPage={setPage}/>
      case 'forecasting':return <Forecasting/>
      case 'optimization':return <Optimization setOutage={setOutage}/>
      case 'twin':return <Twin setPage={setPage}/>
      case 'battery':return <Battery setPage={setPage}/>
      case 'hvac':return <HVAC setPage={setPage}/>
      case 'loads':return <Loads setPage={setPage}/>
      case 'carbon':return <Carbon/>
      case 'outage':return <Outage setOutage={setOutage}/>
      case 'anomalies':return <Anomalies setPage={setPage}/>
      case 'reports':return <Reports setPage={setPage}/>
      default:return <Overview outage={outage} setPage={setPage}/>
    }
  },[page,outage])
  return <div className="app-shell"><AmbientBackground/>
    <div className="sr-only" role="status" aria-live="polite">{pageInfo[page][0]}</div>
    <div className="site-chrome"><Header title={info[0]} page={requestedPage} setPage={setPage}/></div>
    <main className="main-area"><RevealContent className="page-content motion-frame" data-motion={pagePhase} data-view={String(page)} key={page} aria-busy={pagePhase==='leaving'}>
      {content}<footer className="footer"><span>© 2026 EcoPulse Energy Intelligence</span><span><i className="live-dot"/> Energy advisory · Forecasts depend on supplied data</span><span>Built for smarter, cleaner energy</span></footer>
    </RevealContent></main>
  </div>
}
