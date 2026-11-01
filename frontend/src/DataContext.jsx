import React,{createContext,useContext,useState} from 'react'
import {fields} from './data'
import {uploadEnergyReadings} from './energyApi'
const Context=createContext(null)
const storageKey='ecopulse.import.v1'
function load(){try{const saved=JSON.parse(localStorage.getItem(storageKey));if(!saved||!Array.isArray(saved.rows)||!saved.rows.length||saved.rows.length>10000)return null;saved.rows=saved.rows.map(row=>({...row,occupancy:row.occupancy??null}));if(!saved.rows.every(r=>typeof r.timestamp==='string'&&Number.isFinite(Date.parse(r.timestamp))&&typeof r.building==='string'&&r.building&&fields.slice(2).every(([k,,required])=>(!required&&r[k]===null)||(typeof r[k]==='number'&&Number.isFinite(r[k])&&r[k]>=0))))return null;return saved}catch{return null}}
export function DataProvider({children}){
 const [dataset,setDataset]=useState(load)
 const [storageNotice,setStorageNotice]=useState('')
 const apply=async(rows,name)=>{const backendImport=await uploadEnergyReadings(rows);const next={rows,name,importedAt:new Date().toISOString(),backendImport};setDataset(next);try{localStorage.setItem(storageKey,JSON.stringify(next));setStorageNotice(`Saved ${backendImport.created_count} readings to the backend and this browser.`)}catch{try{localStorage.removeItem(storageKey)}catch{}setStorageNotice(`Saved ${backendImport.created_count} readings to the backend. Browser storage is full; this copy is available for this session only.`)}return backendImport}
 const clear=()=>{setDataset(null);try{localStorage.removeItem(storageKey)}catch{}setStorageNotice('Removed this browser copy only. Readings already saved to the backend are unchanged; the original CSV is unchanged.')}
 return <Context.Provider value={{dataset,apply,clear,storageNotice}}>{children}</Context.Provider>
}
export const useData=()=>useContext(Context)
