import React, { createContext, useContext, useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Activity, RefreshCw, Download, Zap, Sun, Building2, AlertTriangle } from 'lucide-react'

const Context = createContext(null)
const names = {campus_a:'Campus A', hospital_a:'Hospital A'}
const signals = {Demand:['demand_kw','kW'], Occupancy:['occupancy','people'], Solar:['solar_kw','kW']}
const number = value => value == null ? 'N/A' : Number(value).toLocaleString('en-IN',{maximumFractionDigits:1})
const stamp = value => new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})

export function DataProvider({children}) {
  const [building,setBuilding] = useState('campus_a')
  const [horizon,setHorizon] = useState(24)
  const [revision,setRevision] = useState(0)
  const [state,setState] = useState({data:null,loading:true,error:''})
  useEffect(()=>{
    const controller = new AbortController()
    setState({data:null,loading:true,error:''})
    fetch(`/api/v1/dashboard?building_id=${encodeURIComponent(building)}&horizon=${horizon}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok) throw new Error(`Server returned ${response.status}`);return response.json()})
      .then(data=>setState({data,loading:false,error:''}))
      .catch(error=>{if(error.name!=='AbortError')setState({data:null,loading:false,error:error.message})})
    return ()=>controller.abort()
  },[building,horizon,revision])
  return <Context.Provider value={{...state,building,setBuilding,horizon,setHorizon,refresh:()=>setRevision(x=>x+1)}}>{children}</Context.Provider>
}

export function ConnectionBar({page}) {
  const {data,loading,error,building,setBuilding,horizon,setHorizon,refresh} = useContext(Context)
  const connected = ['overview','forecasting','anomalies','reports'].includes(page)
  return <div className="connection-panel">
    <div className="connection-status"><span className={`pill ${error?'danger':loading?'info':'success'}`}>{error?'API unavailable':loading?'Loading Python results…':'Python API connected'}</span><b>Synthetic-data demonstration</b><span>{connected?'Computed ML results':'UI preview · control engine not connected'}</span></div>
    <div className="connection-controls"><label>Building <select aria-label="Building" value={building} onChange={e=>setBuilding(e.target.value)}>{Object.entries(names).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Forecast horizon <select aria-label="Forecast horizon" value={horizon} onChange={e=>setHorizon(Number(e.target.value))}><option value={24}>24 hours</option><option value={48}>48 hours</option></select></label><button className="btn" onClick={refresh} disabled={loading}><RefreshCw size={14}/> Refresh data</button><a className="btn" href="/api/v1/download/history"><Download size={14}/> Raw CSV</a></div>
    {data&&<small>Last input: {stamp(data.issued_at)} IST · Forecast starts: {stamp(data.forecast_start)} IST. Refresh recomputes from this fixed dataset.</small>}
    {error&&<p role="alert">Cannot load results: {error}. Check the Python server and retry. No sample numbers are substituted.</p>}
    {!connected&&<p className="preview-warning">This screen preserves the supplied GUI’s illustrative numbers and interactions. It does not run MPC, validate safety constraints, or control equipment.</p>}
  </div>
}

function State({children}) {
  const {data,loading,error,refresh}=useContext(Context)
  if(loading)return <div className="panel state-panel" role="status">Loading forecasts from the Python engine…</div>
  if(error)return <div className="panel state-panel"><h3>Results unavailable</h3><p>{error}</p><button className="btn" onClick={refresh}>Retry connection</button></div>
  return data ? children(data) : null
}
function Title({eyebrow,title,desc}) {return <div className="section-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div></div>}
function Stat({title,value,unit,note,icon:Icon=Activity}) {return <div className="metric-card"><div className="metric-top"><span>{title}</span><span className="metric-icon"><Icon size={17}/></span></div><div className="metric-value">{number(value)}<small> {unit}</small></div><div className="metric-foot muted">{note}</div></div>}
function Chart({data,signal='demand_kw',unit='kW',historical=false}) {
  const rows=historical?data.history:data.forecast
  const chart={labels:rows.map(x=>stamp(x.timestamp)),datasets:historical?[
    {label:`Recorded ${unit}`,data:rows.map(x=>x[signal]),borderColor:'#9dc9d4',backgroundColor:'rgba(157,201,212,.12)',fill:true,pointRadius:0,borderWidth:2}
  ]:[
    {label:'p05 lower estimate',data:rows.map(x=>x[`${signal}_p05`]),borderColor:'#658799',pointRadius:0,borderWidth:1},
    {label:'p95 upper estimate',data:rows.map(x=>x[`${signal}_p95`]),borderColor:'#658799',backgroundColor:'rgba(157,201,212,.17)',fill:'-1',pointRadius:0,borderWidth:1},
    {label:'p50 central estimate',data:rows.map(x=>x[`${signal}_p50`]),borderColor:'#94dac3',pointRadius:1,borderWidth:2.5}
  ]}
  const options={responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{labels:{color:'#b8c9da',boxWidth:15,font:{size:10}}}},scales:{x:{grid:{display:false},ticks:{color:'#9aa9bb',maxTicksLimit:6,maxRotation:0,font:{size:10}}},y:{beginAtZero:true,grid:{color:'#35445a'},title:{display:true,text:unit,color:'#9aa9bb'},ticks:{color:'#9aa9bb'}}}}
  return <div className="forecast-chart"><Line data={chart} options={options}/></div>
}

export function ConnectedOverview(){return <State>{data=><>
  <Title eyebrow="CONNECTED AI/ML WORKSPACE" title="Welcome, Harjeet" desc={`${names[data.building_id]} · Model outputs from your Python forecasting engine`}/>
  <div className="metric-grid"><Stat title="Recorded demand" value={data.summary.historical_demand_kwh} unit="kWh" note="Last 24 hours of simulated readings" icon={Zap}/><Stat title="Forecast demand" value={data.summary.forecast_demand_kwh} unit="kWh" note={`Next ${data.horizon_hours} hours · central estimates`} icon={Activity}/><Stat title="Forecast solar" value={data.summary.forecast_solar_kwh} unit="kWh" note={`Next ${data.horizon_hours} hours · central estimates`} icon={Sun}/><Stat title="Forecast peak demand" value={data.summary.forecast_peak_kw} unit="kW" note="Highest hourly central estimate" icon={Zap}/></div>
  <div className="content-grid"><div className="panel"><div className="panel-head"><div><h3>Demand forecast · next {data.horizon_hours} hours</h3><p>Shaded area: nominal 90% prediction interval</p></div></div><Chart data={data}/></div><div className="panel"><div className="panel-head"><div><h3>Historical demand · previous 24 hours</h3><p>Simulated measurements, shown separately from the future</p></div></div><Chart data={data} historical/></div></div>
  <div className="panel"><h3>Daily forecast summary</h3><p className="panel-sub">Energy totals use hourly central estimates; occupancy is an estimated headcount.</p><div className="ml-table-wrap"><table className="ml-table"><thead><tr><th>Date (IST)</th><th>Hours</th><th>Demand (kWh)</th><th>Solar (kWh)</th><th>Mean occupancy</th></tr></thead><tbody>{data.daily.map(day=><tr key={day.date}><td>{day.date}{day.partial_day?' · partial':''}</td><td>{day.hours_covered}</td><td>{number(day.demand_kwh)}</td><td>{number(day.solar_kwh)}</td><td>{number(day.mean_occupancy)}</td></tr>)}</tbody></table></div></div>
</>}</State>}

export function ConnectedForecasting(){
 const [tab,setTab]=useState('Demand');const [signal,unit]=signals[tab]
 return <State>{data=>{const score=data.metrics[signal].model,first=data.forecast[0];return <>
 <Title eyebrow="PREDICTIVE INTELLIGENCE" title="AI Forecasting" desc={`${names[data.building_id]} · ${data.model}`}/>
 <div className="forecast-tabs">{Object.keys(signals).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t} forecast</button>)}</div>
 <div className="panel"><div className="panel-head"><div><h3>{tab} forecast · Next {data.horizon_hours} hours</h3><p>Forecast origin: {stamp(data.issued_at)} IST</p></div><span className="pill">Nominal 90% interval</span></div><Chart data={data} signal={signal} unit={unit}/></div>
 <div className="metric-grid ml-gap"><Stat title="Next-hour central estimate" value={first[`${signal}_p50`]} unit={unit} note={stamp(first.timestamp)+' IST'}/><Stat title="Held-out MAE" value={score.mae} unit={unit} note="Mean absolute error · 24-hour evaluation"/><Stat title="Held-out RMSE" value={score.rmse} unit={unit} note="Penalizes larger errors"/><Stat title="Measured interval coverage" value={score.interval_coverage_pct} unit="%" note="Nominal target: 90%; not a guarantee"/></div>
 <div className="panel"><h3>What the model knows</h3><p className="panel-sub">Calendar patterns and readings from the same hour of the previous week. Weather forecasts are not included. Validation uses a seven-day chronological holdout with 24-hour forecast origins, even when viewing a 48-hour forecast.</p><p className="panel-sub">Next-hour range: <b>{number(first[`${signal}_p05`])}–{number(first[`${signal}_p95`])} {unit}</b>. Intervals describe uncertainty, not a guaranteed safety margin.</p></div>
 </>}}</State>
}

export function ConnectedAnomalies(){const [signal,setSignal]=useState('all');return <State>{data=>{const rows=data.alerts.filter(x=>signal==='all'||x.signal===signal);return <>
 <Title eyebrow="EXPLAINABLE DETECTION" title="Anomaly Detection" desc="Python detector results from a separate test day, with deliberately injected demand and battery faults."/>
 <div className="metric-grid three"><Stat title="Detected events" value={data.alerts.length} note="Selected building · test readings" icon={AlertTriangle}/><Stat title="Buildings in demo" value={data.buildings.length} note="Campus and hospital profiles" icon={Building2}/><Stat title="Demand anomaly threshold" value={6} unit="robust σ" note="Seasonal median and MAD baseline"/></div>
 <div className="panel"><div className="panel-head"><div><h3>Detected events · {names[data.building_id]}</h3><p>Warnings for investigation; no equipment commands</p></div><select aria-label="Alert signal" value={signal} onChange={e=>setSignal(e.target.value)}><option value="all">All signals</option>{['demand_kw','solar_kw','occupancy','battery_soc_pct'].map(x=><option key={x}>{x}</option>)}</select></div><div className="ml-table-wrap"><table className="ml-table"><thead><tr><th>Time (IST)</th><th>Signal</th><th>Reason</th><th>Observed</th><th>Baseline</th><th>Score</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td>{stamp(row.timestamp)}</td><td>{row.signal}</td><td>{row.reason.replaceAll('_',' ')}</td><td>{number(row.value)}</td><td>{number(row.expected)}</td><td>{number(row.score)}</td></tr>)}</tbody></table>{!rows.length&&<p className="panel-sub">No detected events for this filter.</p>}</div><div className="connection-controls"><a className="btn" href="/api/v1/download/anomaly-readings">Download test readings</a><a className="btn" href="/api/v1/download/alerts">Download all alerts</a></div></div>
 </>}}</State>}

export function ConnectedReports(){return <State>{data=><>
 <Title eyebrow="MEASURED MODEL RESULTS" title="Reports & Metrics" desc="Computed on synthetic data. These are model evaluation results, not real-world savings or safety validation."/>
 <div className="panel"><div className="panel-head"><div><h3>Chronological validation · {names[data.building_id]}</h3><p>{data.evaluation.method} · {data.evaluation.test_days} test days</p></div><a className="btn" href="/api/v1/download/evaluation"><Download size={14}/> Export JSON</a></div><div className="ml-table-wrap"><table className="ml-table"><thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>Weekly baseline MAE</th><th>MAPE*</th><th>Interval coverage</th></tr></thead><tbody>{Object.entries(signals).map(([name,[key,unit]])=>{const m=data.metrics[key];return <tr key={key}><td>{name} ({unit})</td><td>{number(m.model.mae)}</td><td>{number(m.model.rmse)}</td><td>{number(m.weekly_baseline.mae)}</td><td>{number(m.model.mape_nonzero_pct)}%</td><td>{number(m.model.interval_coverage_pct)}%</td></tr>})}</tbody></table></div><p className="panel-sub">*MAPE excludes zero actual values; excluded counts are included in the JSON export. Lower MAE and RMSE are better. Compare each model with the same-hour-last-week baseline.</p></div>
 <div className="content-grid ml-gap"><div className="panel"><h3>Download demo artifacts</h3><p className="panel-sub">Exports contain both buildings. Hourly and daily exports are the original 24-hour demo run.</p><div className="download-grid">{[['history','Raw input CSV'],['hourly','Hourly forecasts CSV'],['daily','Daily forecasts CSV'],['evaluation','Accuracy report JSON'],['alerts','Detected alerts JSON']].map(([key,label])=><a className="btn" key={key} href={`/api/v1/download/${key}`}><Download size={14}/>{label}</a>)}</div></div><div className="panel"><h3>Integration status</h3><p className="panel-sub">Connected: demand, occupancy, solar forecasts, uncertainty intervals, anomaly detection and accuracy evaluation.</p><p className="panel-sub">Awaiting the control engine: cost and carbon savings, comfort violations, critical-load protection and optimized battery schedules. These outcomes have not been calculated or validated by this module.</p></div></div>
 </>}</State>}
