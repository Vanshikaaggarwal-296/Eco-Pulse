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
  Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleHelp,
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
  const {dataset}=useData()
  if(dataset) return <ImportedOverview setPage={setPage}/>
  const lineData = { labels: demandLabels, datasets: [
    { label:'Actual demand', data:demandActual, borderColor:'#c9283e', backgroundColor:'rgba(201,40,62,.08)', fill:true, tension:.38, borderWidth:2.5, pointRadius:0, pointHoverRadius:4 },
    { label:'AI forecast', data:demandForecast, borderColor:'#746b80', borderDash:[5,5], tension:.38, borderWidth:2, pointRadius:0 }
  ]}
  const mixData = { labels:['Grid','Solar','Battery'], datasets:[{data:[58,29,13],backgroundColor:['#ded5d0','#c9283e','#343b4e'],borderWidth:0,hoverOffset:4}] }
  return <>
    <SectionTitle eyebrow="CAMPUS ENERGY OVERVIEW" title="Good afternoon, Admin" desc="Here’s how your campus energy system is performing today." right={<><Button><CalendarDays size={15}/> Oct 31, 2026 <ChevronDown size={14}/></Button><Button kind="primary" onClick={()=>setPage('optimization')}><SlidersHorizontal size={15}/> Optimize system</Button></>}/>
    {outage && <div className="outage-banner"><AlertTriangle size={18}/><div><b>Grid outage simulation is active</b><span>Critical loads are being prioritized using the backup reserve scenario.</span></div><button onClick={()=>setPage('outage')}>View simulation <ChevronRight size={15}/></button></div>}
    <div className="metric-grid">
      <Metric label="Total energy consumption" value="2,846" unit=" kWh" change="8.4% vs baseline" note="vs. previous day" icon={Zap}/>
      <Metric label="Renewable energy share" value="42.6" unit="%" change="6.2% improvement" note="vs. previous day" icon={Sun}/>
      <Metric label="CO₂ emissions avoided" value="386" unit=" kg" change="12.8% improvement" note="vs. baseline" icon={Leaf}/>
      <Metric label="Estimated energy cost" value="₹24,680" unit="" change="5.1% lower" note="vs. baseline" icon={TrendingDown}/>
    </div>
    <div className="content-grid overview-main">
      <div className="panel demand-panel">
        <div className="panel-head"><div><h3>Energy demand & forecast</h3><p>Actual consumption compared with AI prediction</p></div><div className="segmented">{['Today','7 days','30 days'].map(v=><button className={range===v?'selected':''} onClick={()=>setRange(v)} key={v}>{v}</button>)}</div></div>
        <div className="chart-legend"><span><i className="legend-dot actual"/> Actual demand</span><span><i className="legend-line"/> AI forecast</span><span className="confidence-label"><span className="confidence-swatch"/> 90% confidence range</span></div>
        <div className="main-chart motion-frame" data-motion={rangePhase} data-view={String(range)} key={range}><Line data={lineData} options={lineOptions}/></div>
        <div className="chart-summary"><div><span className="summary-label">Peak demand</span><b>430 kW</b><small>Expected at 2:00 PM</small></div><div><span className="summary-label">Forecast confidence</span><b>92.4%</b><small>± 24 kW uncertainty</small></div><div><span className="summary-label">Current demand</span><b>318 kW</b><small><span className="live-dot"/> Updated 2 min ago</small></div></div>
      </div>
      <div className="panel energy-panel">
        <div className="panel-head"><div><h3>Energy mix</h3><p>Where your electricity comes from</p></div><button className="more-btn"><MoreHorizontal size={18}/></button></div>
        <div className="donut-wrap"><Doughnut data={mixData} options={{cutout:'76%',plugins:{legend:{display:false},tooltip:{enabled:true}}}}/><div className="donut-center"><b>42.6%</b><span>Renewable</span></div></div>
        <div className="mix-legend"><div><span><i className="mix-dot grid"/> Grid electricity</span><b>58% <small>1,650 kWh</small></b></div><div><span><i className="mix-dot solar"/> Solar generation</span><b>29% <small>825 kWh</small></b></div><div><span><i className="mix-dot battery"/> Battery discharge</span><b>13% <small>371 kWh</small></b></div></div>
        <div className="energy-note"><Sun size={15}/><span>Solar generation is <b>14% above</b> forecast today.</span></div>
      </div>
    </div>
    <div className="content-grid lower-grid">
      <div className="panel buildings-panel"><div className="panel-head"><div><h3>Building performance</h3><p>Live energy consumption by campus building</p></div><button className="text-link" onClick={()=>setPage('twin')}>View digital twin <ChevronRight size={14}/></button></div>
        <div className="building-table"><div className="table-row table-head"><span>BUILDING</span><span>ENERGY USE</span><span>LOAD</span><span>STATUS</span></div>
          {[['Academic Block A','684 kWh',72,'Optimal'],['Research Centre','512 kWh',58,'Optimal'],['Central Library','426 kWh',46,'Efficient'],['Student Residence','738 kWh',84,'High usage'],['Administration','486 kWh',51,'Optimal']].map(([n,v,p,s])=><div className="table-row" key={n}><span className="building-name"><i className="building-symbol"><Building2 size={15}/></i><b>{n}</b></span><span className="energy-number">{v}</span><span><div className="progress"><i style={{width:p+'%'}}/></div></span><span><i className={`status-dot ${s==='High usage'?'warning':''}`}/><small>{s}</small></span></div>)}
        </div>
      </div>
      <div className="panel alerts-panel"><div className="panel-head"><div><h3>System insights</h3><p>AI-generated observations</p></div><span className="count-badge">3 new</span></div>
        <div className="insight"><div className="insight-icon green-bg"><Sun size={16}/></div><div><b>Solar output above forecast</b><p>Generation is 14% higher than expected. Consider charging the battery.</p><small>8 minutes ago</small></div></div>
        <div className="insight"><div className="insight-icon amber-bg"><Zap size={16}/></div><div><b>Peak demand approaching</b><p>Research Centre load may exceed its usual afternoon range.</p><small>21 minutes ago</small></div></div>
        <div className="insight"><div className="insight-icon blue-bg"><BatteryCharging size={16}/></div><div><b>Battery health normal</b><p>Storage system operating within recommended limits.</p><small>35 minutes ago</small></div></div>
      </div>
    </div>
    {showTip && <div className="tip-banner"><div className="tip-icon"><Lightbulb size={18}/></div><div><b>Optimization opportunity detected</b><p>Shifting flexible loads to the 11:00 AM–1:00 PM solar peak could save an estimated ₹1,240 and avoid 18 kg CO₂ today.</p></div><button onClick={()=>setPage('optimization')}>Review recommendation <ChevronRight size={15}/></button><button className="dismiss" onClick={()=>setShowTip(false)}><X size={16}/></button></div>}
  </>
}

function Forecasting() {
  const [tab,setTab,tabPhase,requestedTab]=useAnimatedValue('Demand')
  const [csvText,setCsvText]=useState('')
  const [fileName,setFileName]=useState('')
  const [buildings,setBuildings]=useState([])
  const [buildingId,setBuildingId]=useState('')
  const [timezone,setTimezone]=useState('Asia/Kolkata')
  const [horizon,setHorizon]=useState(24)
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
    setLoading(true);setError('');setNotice('Training forecasts and evaluating the chronological holdout…')
    try{
      setResult(await runForecastAnalysis({csv_text:csvText,building_id:buildingId,timezone,horizon:Number(horizon)}))
      setNotice('Forecasts, evaluation metrics and anomaly results came from the backend.')
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
      </div>
      <div className="forecast-input-actions"><Button onClick={loadSample} disabled={loading}><Zap size={14}/> Load synthetic demo data</Button><Button kind="primary" onClick={run} disabled={!csvText||loading}><Cpu size={14}/>{loading?'Training models…':'Run backend forecast'}</Button></div>
      {notice&&<p className="forecast-feedback" role="status">{notice}</p>}
      {error&&<div className="forecast-error" role="alert"><AlertTriangle size={17}/><div><b>Forecast request could not complete</b><p>{error}</p></div></div>}
    </div>
    {result&&<>
      <div className="optimization-banner"><div className="opt-icon"><Activity size={20}/></div><div><b>Backend forecast received · {buildingId}</b><p>POST /api/forecasting/analyze · {horizon}-hour horizon · source: uploaded CSV. No equipment is controlled.</p></div><span className="pill success">{result.evaluation?.test_days||7}-day holdout</span></div>
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
  const [result,setResult]=useState(null)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const run=async()=>{
    setLoading(true);setError('')
    try { setResult(await runScheduleRecommendation()) }
    catch (reason) { setResult(null);setError(reason?.name==='AbortError'?'The backend took too long to respond. Check that it is running.':reason?.message||'Could not reach the optimization API.') }
    finally { setLoading(false) }
  }
  const metrics=result?.metrics
  const money=value=>typeof value==='number'?'₹'+Math.round(value).toLocaleString('en-IN'):'—'
  const number=value=>typeof value==='number'?value.toFixed(2):'—'
  return <>
    <SectionTitle eyebrow="INTELLIGENT CONTROL" title="Energy Optimization" desc="Get a recommendation from the Eco-Pulse backend using a sample four-interval forecast." right={<Button kind="primary" disabled={loading} onClick={run}><Cpu size={15}/>{loading?'Requesting API…':'Run backend optimization'}</Button>}/>
    <div className="optimization-banner"><div className="opt-icon"><SlidersHorizontal size={21}/></div><div><b>{result?'Backend recommendation received':'Recommendation-only controller'}</b><p>{result?'This schedule came from POST /api/optimization/schedule. It does not control equipment.':'Run the API to calculate a schedule, estimated savings and battery dispatch for the demo profile.'}</p></div><span className="pill success"><span className="live-dot"/> Human approval required</span></div>
    {error&&<div className="note-panel" role="alert"><AlertTriangle size={19}/><div><b>Optimization request failed</b><p>{error}</p></div></div>}
    <div className="metric-grid three"><Metric label="Estimated cost savings" value={money(metrics?.estimated_cost_savings)} change={metrics?'Backend result':'Run the backend API'} note="4-interval demo" icon={TrendingDown}/><Metric label="Estimated carbon savings" value={number(metrics?.estimated_carbon_savings_kg)} unit={metrics?' kg CO₂e':''} change={metrics?'Backend result':'Run the backend API'} note="4-interval demo" icon={Leaf}/><Metric label="Peak demand reduction" value={number(metrics?.estimated_peak_reduction_kw)} unit={metrics?' kW':''} change={metrics?'Backend result':'Run the backend API'} note="4-interval demo" icon={Gauge}/></div>
    <div className="content-grid"><div className="panel"><div className="panel-head"><div><h3>Recommended control schedule</h3><p>{result?'Live response from the optimization endpoint':'No API result yet'}</p></div><span className="pill info">Advisory only</span></div>
      {result?.schedule?.map(step=>{const charge=(step.battery_charge_from_grid_kwh||0)+(step.battery_charge_from_solar_kwh||0);const discharge=step.battery_discharge_kwh||0;const action=charge>0.01?'Charge battery':discharge>0.01?'Discharge battery':'Hold battery';return <div className="dispatch-row" key={step.step}><div className={`dispatch-icon ${charge>0.01?'charge':''}`}><BatteryCharging size={17}/></div><div><b>Interval {Number(step.step)+1} · {action}</b><small>Grid import {number(step.grid_import_kwh)} kWh · battery SOC {number(step.battery_soc_kwh)} kWh · flexible load shed {number(step.flexible_load_shed_kwh)} kWh</small></div><strong>{number(step.renewable_used_kwh)} kWh solar</strong></div>})}
      {!result&&<div className="safe-note"><ShieldCheck size={17}/><span>The values shown elsewhere in the dashboard are illustrative. Run the backend optimization to display its actual returned schedule here.</span></div>}
      {result&&<div className="safe-note"><ShieldCheck size={17}/><span>{result.requires_human_approval?'Human review is required. ':''}No equipment is automatically switched. Mode: {result.mode}.</span></div>}
    </div><div className="panel constraints-panel"><h3>Safety constraints</h3><p className="panel-sub">Enforced by the backend controller</p>{[['Critical loads','Always prioritized','Protected'],['HVAC minimum','Included in request','Enforced'],['Battery reserve','3 kWh','Protected'],['Grid import limit','3 kW','Applied'],['Equipment switching','Recommendation only','Disabled']].map(row=><div className="constraint" key={row[0]}><div><b>{row[0]}</b><small>{row[1]}</small></div><span><CheckCircle2 size={14}/>{row[2]}</span></div>)}<div className="safe-note"><ShieldCheck size={17}/><span>Review the schedule before any separate, authorized control system uses it.</span></div></div></div>
  </>
}

function Battery({setPage}) {
  return <><SectionTitle eyebrow="ENERGY STORAGE" title="Battery & Storage" desc="Monitor battery health, reserve capacity and dispatch strategy." right={<Button><CalendarDays size={15}/> 24-hour view</Button>}/><div className="content-grid battery-grid"><div className="panel battery-hero"><div className="panel-head"><div><h3>Main campus battery</h3><p>Storage system · BESS-01</p></div><span className="pill success">Online</span></div><div className="battery-visual"><div className="battery-outline"><div className="battery-fill"/></div><div><b>76<span>%</span></b><small>State of charge</small></div></div><div className="battery-stats"><div><span>Available energy</span><b>380 kWh</b></div><div><span>Rated capacity</span><b>500 kWh</b></div><div><span>Battery health</span><b>97.2%</b></div></div></div><div className="panel"><h3>Battery operating limits</h3><p className="panel-sub">Controller-enforced protection</p><div className="limit-row"><span>Minimum SOC</span><b>20%</b></div><div className="limit-track"><i style={{left:'20%'}}/></div><div className="limit-row"><span>Current SOC</span><b className="green-text">76%</b></div><div className="limit-track current"><i style={{width:'76%'}}/></div><div className="limit-row"><span>Maximum SOC</span><b>90%</b></div><div className="safe-note"><ShieldCheck size={17}/><span>Reserve capacity is protected for critical loads and outage resilience.</span></div></div></div><div className="content-grid"><div className="panel"><div className="panel-head"><div><h3>Suggested dispatch schedule</h3><p>Based on sample price and carbon forecasts</p></div></div>{[['10 AM – 2 PM','Charge','Solar surplus expected','+120 kWh'],['2 PM – 5 PM','Hold','Preserve reserve for evening','0 kWh'],['6 PM – 9 PM','Discharge','High tariff period; reserve protected','−85 kWh']].map((r,i)=><div className="dispatch-row" key={r[0]}><div className={`dispatch-icon ${i===0?'charge':''}`}><BatteryCharging size={17}/></div><div><b>{r[0]} · {r[1]}</b><small>{r[2]}</small></div><strong>{r[3]}</strong></div>)}</div><div className="panel"><h3>Backup readiness</h3><div className="backup-number">4.8 <small>hours</small></div><p className="panel-sub">Estimated critical-load backup duration</p><Button kind="primary" onClick={()=>setPage('outage')}>Run outage simulation <ChevronRight size={14}/></Button></div></div></>
}

function HVAC() {
  const [setpoint,setSetpoint]=useState(24)
  return <><SectionTitle eyebrow="BUILDING COMFORT" title="HVAC Management" desc="Occupancy-aware climate scheduling with comfort and safety limits."/><div className="metric-grid three"><Metric label="Active HVAC zones" value="18" unit=" / 22" change="4 zones idle" note="occupancy-aware" icon={Snowflake}/><Metric label="Average indoor temp" value="24.1" unit="°C" change="Within comfort band" note="campus average" icon={Thermometer}/><Metric label="HVAC energy today" value="1,024" unit=" kWh" change="7.3% lower" note="vs. baseline" icon={Zap}/></div><div className="content-grid"><div className="panel"><div className="panel-head"><div><h3>Zone climate controls</h3><p>Sample zones · advisory setpoints</p></div><span className="pill success">Comfort protected</span></div>{[['Academic Block A','Occupied','23.8°C','Cooling'],['Research Centre','Occupied','24.4°C','Cooling'],['Central Library','Partially occupied','23.9°C','Auto'],['Administration','Low occupancy','25.1°C','Eco']].map((r,i)=><div className="zone-row" key={r[0]}><div className="zone-symbol"><Snowflake size={17}/></div><div className="zone-name"><b>{r[0]}</b><small>{r[1]}</small></div><div className="zone-temp">{r[2]}</div><span className="pill info">{r[3]}</span></div>)}</div><div className="panel setpoint-panel"><h3>Comfort policy</h3><p className="panel-sub">Demo control for a selected zone</p><div className="setpoint-value">{setpoint}<small>°C</small></div><input aria-label="Temperature setpoint" type="range" min="22" max="26" value={setpoint} onChange={e=>setSetpoint(Number(e.target.value))}/><div className="range-labels"><span>22°C · Cool</span><span>26°C · Warm</span></div><div className="safe-note"><ShieldCheck size={17}/><span>Setpoint remains inside the sample 22–26°C comfort band. Hospital-specific limits must be configured separately.</span></div></div></div></>
}

function Loads() {
  const [showCritical,setShowCritical,loadPhase]=useAnimatedValue(true)
  return <><SectionTitle eyebrow="LOAD MANAGEMENT" title="Smart Loads" desc="Prioritize essential services and schedule flexible electrical demand."/><div className="panel"><div className="panel-head"><div><h3>Load priority register</h3><p>Sample campus electrical loads and operating classification</p></div><div className="segmented"><button className={showCritical?'selected':''} onClick={()=>setShowCritical(true)}>All loads</button><button className={!showCritical?'selected':''} onClick={()=>setShowCritical(false)}>Flexible only</button></div></div><div className="load-table motion-frame" data-motion={loadPhase} data-view={String(showCritical)} key={String(showCritical)}><div className="load-row head"><span>LOAD / EQUIPMENT</span><span>CLASSIFICATION</span><span>DEMAND</span><span>CONTROL POLICY</span><span>STATUS</span></div>{[['Emergency lighting','Critical','42 kW','Always on','Protected'],['Server & network room','Critical','68 kW','Always on','Protected'],['Medical / safety systems','Critical','35 kW','Always on','Protected'],['Water pumping','Flexible','54 kW','Schedule eligible','Scheduled'],['EV charging bays','Flexible','76 kW','Deferrable','Standby'],['Common-area lighting','Flexible','28 kW','Occupancy based','Optimized'],['Laundry / utility loads','Flexible','44 kW','Schedule eligible','Scheduled']].filter(r=>showCritical||r[1]==='Flexible').map(r=><div className="load-row" key={r[0]}><b>{r[0]}</b><span><i className={`priority-dot ${r[1]==='Critical'?'critical':'flexible'}`}/>{r[1]}</span><strong>{r[2]}</strong><span>{r[3]}</span><span className="pill success">{r[4]}</span></div>)}</div></div><div className="note-panel"><ShieldCheck size={19}/><div><b>Critical-load protection is a hard constraint</b><p>EcoPulse may recommend shifting flexible loads, but never automatically disconnects critical or life-safety equipment.</p></div></div></>
}

function Carbon() {
  const bars={labels:['06 AM','08 AM','10 AM','12 PM','02 PM','04 PM','06 PM','08 PM','10 PM'],datasets:[{label:'Grid carbon intensity',data:[620,590,510,390,360,410,570,640,610],backgroundColor:'#c9283e',borderRadius:5}]}
  return <><SectionTitle eyebrow="SUSTAINABILITY INTELLIGENCE" title="Carbon Intelligence" desc="Understand grid carbon intensity and shift flexible demand to cleaner energy windows."/><div className="metric-grid three"><Metric label="Grid carbon intensity" value="412" unit=" gCO₂/kWh" change="18% lower" note="vs. monthly average" icon={Leaf}/><Metric label="Carbon avoided today" value="386" unit=" kg CO₂e" change="12.8% improvement" note="estimated vs baseline" icon={TrendingDown}/><Metric label="Renewable utilization" value="91.3" unit="%" change="4.6% higher" note="of available solar" icon={Sun}/></div><div className="content-grid"><div className="panel"><div className="panel-head"><div><h3>Grid carbon intensity by hour</h3><p>Illustrative grid signal · gCO₂e per kWh</p></div></div><div className="forecast-chart"><Bar data={bars} options={{...lineOptions,plugins:{legend:{display:false}},scales:{...lineOptions.scales,y:{...lineOptions.scales.y,ticks:{...lineOptions.scales.y.ticks,callback:v=>v+' g'}}}}}/></div></div><div className="panel"><h3>Cleaner energy windows</h3><p className="panel-sub">Suggested periods for flexible loads</p>{[['11 AM – 2 PM','Low carbon','Solar-rich period','Best'],['2 PM – 4 PM','Moderate','Good solar availability','Good'],['8 PM – 10 PM','High carbon','Avoid deferrable demand','Avoid']].map((r,i)=><div className="carbon-window" key={r[0]}><div className={`window-indicator w${i}`}/><div><b>{r[0]}</b><small>{r[2]}</small></div><span className={`pill ${i===0?'success':i===1?'info':'warning'}`}>{r[3]}</span></div>)}</div></div><div className="note-panel"><Activity size={19}/><div><b>Carbon-aware scheduling is operationally constrained</b><p>Recommendations are applied only when comfort, service availability, battery reserve and critical-load requirements remain satisfied.</p></div></div></>
}

function Twin({setPage}) {
  const [scenario,setScenario,scenarioPhase]=useAnimatedValue('optimized')
  const buildings=[['Academic Block A',684,72],['Research Centre',512,58],['Central Library',426,46],['Student Residence',738,84],['Administration',486,51]]
  return <><SectionTitle eyebrow="VIRTUAL ENERGY SYSTEM" title="Digital Twin" desc="Explore a simulated campus energy system and compare operating scenarios." right={<Button kind="primary" onClick={()=>setPage('optimization')}><Cpu size={15}/> Open controller</Button>}/><div className="twin-toolbar"><div><span className="live-dot"/> SIMULATION ENVIRONMENT <span className="muted">· Sample campus model</span></div><div className="segmented"><button className={scenario==='baseline'?'selected':''} onClick={()=>setScenario('baseline')}>Baseline</button><button className={scenario==='optimized'?'selected':''} onClick={()=>setScenario('optimized')}>Optimized</button></div></div><div className="twin-layout motion-frame" data-motion={scenarioPhase} data-view={String(scenario)} key={scenario}><div className="panel twin-canvas"><div className="twin-sky"><div className="sun-orb"/><div className="cloud cloud-one"/><div className="cloud cloud-two"/></div><div className="campus-ground"><div className="road road-h"/><div className="road road-v"/><div className="green-space gs-one"/><div className="green-space gs-two"/><div className="building-3d b-one"><div className="roof"/><div className="windows"/></div><div className="building-3d b-two"><div className="roof"/><div className="windows"/></div><div className="building-3d b-three"><div className="roof"/><div className="windows"/></div><div className="building-3d b-four"><div className="roof"/><div className="windows"/></div><div className="solar-field"><div/><div/><div/><div/><div/><div/></div><div className="twin-label label-a">Academic Block A <b>684 kWh</b></div><div className="twin-label label-b">Research Centre <b>512 kWh</b></div><div className="twin-label label-c">Central Library <b>426 kWh</b></div><div className="twin-label label-d">Student Residence <b>738 kWh</b></div><div className="solar-label"><Sun size={13}/> Solar array · 825 kWh</div></div><div className="twin-legend"><span><i className="legend-building"/> Building</span><span><i className="legend-solar"/> Solar generation</span><span><i className="legend-energy"/> Energy flow</span></div></div><div className="panel twin-side"><h3>Scenario performance</h3><p className="panel-sub">{scenario==='optimized'?'Optimized operation':'Baseline operation'} · 24-hour simulation</p><div className="scenario-total"><span>Total energy demand</span><b>{scenario==='optimized'?'2,846':'3,120'} <small>kWh</small></b></div><div className="scenario-total"><span>Grid import</span><b>{scenario==='optimized'?'1,650':'2,140'} <small>kWh</small></b></div><div className="scenario-total"><span>CO₂e emissions</span><b>{scenario==='optimized'?'1,042':'1,356'} <small>kg</small></b></div><div className="scenario-total"><span>Peak demand</span><b>{scenario==='optimized'?'430':'482'} <small>kW</small></b></div><div className="scenario-delta"><TrendingDown size={17}/><div><b>{scenario==='optimized'?'23.2% lower emissions':'Baseline reference'}</b><small>{scenario==='optimized'?'Compared with baseline scenario':'Switch to optimized to view potential savings'}</small></div></div><Button kind="primary" onClick={()=>setScenario(scenario==='optimized'?'baseline':'optimized')}>Compare {scenario==='optimized'?'baseline':'optimized'} scenario</Button></div></div><div className="panel"><div className="panel-head"><div><h3>Building telemetry</h3><p>Simulated live readings from campus assets</p></div><span className="pill success">5 assets online</span></div><div className="telemetry-grid">{buildings.map(b=><div className="telemetry-card" key={b[0]}><Building2 size={17}/><b>{b[0]}</b><strong>{b[1]} <small>kWh</small></strong><div className="progress"><i style={{width:b[2]+'%'}}/></div><small>{b[2]}% of typical peak</small></div>)}</div></div></>
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

function Anomalies() {
  const [filter,setFilter,filterPhase]=useAnimatedValue('All')
  const rows=[['Unusual demand spike','Research Centre','High','12:42 PM','Open'],['Solar output deviation','Rooftop PV array','Medium','11:18 AM','Investigating'],['Battery charge-rate variance','BESS-01','Low','09:36 AM','Resolved']]
  return <><SectionTitle eyebrow="SYSTEM HEALTH" title="Anomaly Detection" desc="Identify unusual patterns in energy consumption, renewable generation and storage behaviour." right={<Button><RefreshCw size={15}/> Run detection</Button>}/><div className="metric-grid three"><Metric label="Active alerts" value="2" change="1 high priority" note="requires review" icon={AlertTriangle} positive={false} tint="amber"/><Metric label="Assets monitored" value="24" change="All reporting" note="campus assets" icon={Activity}/><Metric label="Detection accuracy" value="96.8" unit="%" change="Validated sample" note="illustrative metric" icon={ShieldCheck}/></div><div className="panel"><div className="panel-head"><div><h3>Detected events</h3><p>Sample anomaly events from simulated telemetry</p></div><div className="segmented">{['All','Open','Resolved'].map(v=><button className={filter===v?'selected':''} onClick={()=>setFilter(v)} key={v}>{v}</button>)}</div></div><div className="motion-frame" data-motion={filterPhase} data-view={String(filter)} key={filter}>{rows.filter(r=>filter==='All'||(filter==='Open'?r[4]!=='Resolved':r[4]==='Resolved')).map(r=><div className="anomaly-row" key={r[0]}><div className={`anomaly-icon ${r[2].toLowerCase()}`}><AlertTriangle size={17}/></div><div className="anomaly-name"><b>{r[0]}</b><small>{r[1]}</small></div><span className={`pill ${r[2]==='High'?'danger':r[2]==='Medium'?'warning':'info'}`}>{r[2]} severity</span><span className="anomaly-time">{r[3]}</span><span className={`pill ${r[4]==='Resolved'?'success':'info'}`}>{r[4]}</span></div>)}</div></div><div className="note-panel"><Activity size={19}/><div><b>Explainable anomaly workflow</b><p>Each event should include a baseline comparison, detection score, affected asset and recommended investigation. Alerts do not directly control equipment.</p></div></div></>
}

function Reports() {
  const [period,setPeriod,periodPhase]=useAnimatedValue('This month')
  return <><SectionTitle eyebrow="PERFORMANCE & INSIGHTS" title="Reports & Metrics" desc="Track financial, environmental and operational outcomes across your energy system." right={<Button kind="primary" onClick={()=>window.print()}><Download size={15}/> Export report</Button>}/><div className="report-toolbar"><span>Reporting period</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option>This month</option><option>Last 7 days</option><option>Today</option></select><span className="muted">Sample dataset · October 2026</span></div><div className="metric-grid motion-frame" data-motion={periodPhase} data-view={String(period)} key={period}><Metric label="Estimated cost savings" value="₹38,420" change="8.7% vs baseline" note={period} icon={TrendingDown}/><Metric label="CO₂e reduction" value="2.84" unit=" tonnes" change="11.2% vs baseline" note={period} icon={Leaf}/><Metric label="Peak demand reduction" value="12.4" unit="%" change="52 kW reduction" note={period} icon={Gauge}/><Metric label="Renewable utilization" value="91.3" unit="%" change="4.6% improvement" note={period} icon={Sun}/></div><div className="content-grid"><div className="panel"><h3>Operational success metrics</h3><p className="panel-sub">Validation indicators for the simulated controller</p>{[['Demand forecast MAE','18.6 kW','Within target'],['Demand forecast RMSE','24.1 kW','Within target'],['Comfort violations','0','Target: 0'],['Critical-load violations','0','Target: 0'],['Battery limit violations','0','Target: 0']].map(r=><div className="report-row" key={r[0]}><span>{r[0]}</span><b>{r[1]}</b><span className="pill success">{r[2]}</span></div>)}</div><div className="panel"><h3>Measurement methodology</h3><p className="panel-sub">How EcoPulse evaluates impact</p><div className="method"><b>Cost reduction</b><p>Baseline energy cost minus optimized energy cost over the same simulated period.</p></div><div className="method"><b>CO₂e avoided</b><p>Difference in grid-import emissions using the time-varying carbon-intensity signal.</p></div><div className="method"><b>Forecast error</b><p>MAE and RMSE for continuous predictions; MAPE only where actual values are non-zero.</p></div></div></div><div className="note-panel"><CircleHelp size={19}/><div><b>Demo data disclosure</b><p>All figures currently use illustrative simulated campus data. Replace these values with validated meter data and measured model outputs before making operational or financial claims.</p></div></div></>
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
      case 'hvac':return <HVAC/>
      case 'loads':return <Loads/>
      case 'carbon':return <Carbon/>
      case 'outage':return <Outage setOutage={setOutage}/>
      case 'anomalies':return <Anomalies/>
      case 'reports':return <Reports/>
      default:return <Overview outage={outage} setPage={setPage}/>
    }
  },[page,outage])
  return <div className="app-shell"><AmbientBackground/>
    <div className="sr-only" role="status" aria-live="polite">{pageInfo[page][0]}</div>
    <div className="site-chrome"><Header title={info[0]} page={requestedPage} setPage={setPage}/></div>
    <main className="main-area"><RevealContent className="page-content motion-frame" data-motion={pagePhase} data-view={String(page)} key={page} aria-busy={pagePhase==='leaving'}>
      {content}<footer className="footer"><span>© 2026 EcoPulse Energy Intelligence</span><span><i className="live-dot"/> Frontend preview · Demo AI screens</span><span>Built for smarter, cleaner energy</span></footer>
    </RevealContent></main>
  </div>
}
