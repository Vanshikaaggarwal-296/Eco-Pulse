import React,{createContext,useContext,useEffect,useState} from 'react'
import {fields} from './data'
import {getAllEnergyReadings,uploadEnergyReadings} from './energyApi'
import {getLatestForecastAnalysis} from './forecastingApi'

const Context=createContext(null)
const storageKey='ecopulse.import.v1'

function loadLocalDataset(){
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey))
  if(!saved||!Array.isArray(saved.rows)||!saved.rows.length||saved.rows.length>10000)return null
  saved.rows=saved.rows.map(row=>({...row,occupancy:row.occupancy??null}))
  if(!saved.rows.every(row=>typeof row.timestamp==='string'&&Number.isFinite(Date.parse(row.timestamp))&&typeof row.building==='string'&&row.building&&fields.slice(2).every(([key,,required])=>(!required&&row[key]===null)||(typeof row[key]==='number'&&Number.isFinite(row[key])&&row[key]>=0))))return null
  return {...saved,source:'browser'}
 }catch{return null}
}

function toDataset(rows,name,source='backend'){
 const normalized=rows.map(row=>({
  timestamp:row.timestamp,
  building:row.building_id,
  consumption_kwh:row.consumption_kwh,
  solar_used_kwh:row.solar_generation_kwh,
  grid_import_kwh:row.grid_import_kwh,
  cost_inr:row.cost_inr,
  carbon_kg:row.carbon_kg,
  occupancy:row.occupancy,
  id:row.id
 }))
 return {rows:normalized,name,importedAt:new Date().toISOString(),source}
}

export function DataProvider({children}){
 const [localDataset,setLocalDataset]=useState(loadLocalDataset)
 const [backendDataset,setBackendDataset]=useState(null)
 const [backendLoading,setBackendLoading]=useState(true)
 const [backendError,setBackendError]=useState('')
 const [storageNotice,setStorageNotice]=useState('')
 const [forecastAnalysis,setForecastAnalysis]=useState(null)

 useEffect(()=>{
  let active=true
  getAllEnergyReadings()
   .then(rows=>{if(active&&rows.length)setBackendDataset(toDataset(rows,'Backend energy readings'))})
   .catch(error=>{if(active)setBackendError(error.message||'Could not load readings from the backend.')})
   .finally(()=>{if(active)setBackendLoading(false)})
  getLatestForecastAnalysis()
   .then(run=>{if(active&&run)setForecastAnalysis(run)})
   .catch(()=>{})
  return()=>{active=false}
 },[])

 const dataset=backendDataset||localDataset
 const apply=async(rows,name)=>{
  const backendImport=await uploadEnergyReadings(rows)
  const next={rows,name,importedAt:new Date().toISOString(),backendImport,source:'browser'}
  setLocalDataset(next)
  setBackendDataset(toDataset(rows.map(row=>({
   timestamp:row.timestamp,building_id:row.building,consumption_kwh:row.consumption_kwh,
   solar_generation_kwh:row.solar_used_kwh??0,occupancy:row.occupancy,
   grid_import_kwh:row.grid_import_kwh,cost_inr:row.cost_inr,carbon_kg:row.carbon_kg
  })),name))
  try{
   localStorage.setItem(storageKey,JSON.stringify(next))
   setStorageNotice(`Saved ${backendImport.created_count} readings to the backend and this browser.`)
  }catch{
   try{localStorage.removeItem(storageKey)}catch{}
   setStorageNotice(`Saved ${backendImport.created_count} readings to the backend. Browser storage is full; this copy is available for this session only.`)
  }
  return backendImport
 }

 const clear=()=>{
  setLocalDataset(null)
  try{localStorage.removeItem(storageKey)}catch{}
  setStorageNotice('Removed this browser copy. Backend readings remain available and are shown from the shared database.')
 }

 return <Context.Provider value={{dataset,apply,clear,storageNotice,backendLoading,backendError,forecastAnalysis,setForecastAnalysis}}>{children}</Context.Provider>
}

export const useData=()=>useContext(Context)
