import React,{createContext,useContext,useState} from 'react'
import {fields} from './data'
const Context=createContext(null)
const storageKey='ecopulse.import.v1'
function load(){try{const saved=JSON.parse(localStorage.getItem(storageKey));if(!saved||!Array.isArray(saved.rows)||!saved.rows.length||saved.rows.length>10000)return null;if(!saved.rows.every(r=>typeof r.timestamp==='string'&&Number.isFinite(Date.parse(r.timestamp))&&typeof r.building==='string'&&r.building&&fields.slice(2).every(([k,,required])=>(!required&&r[k]===null)||(typeof r[k]==='number'&&Number.isFinite(r[k])&&r[k]>=0))))return null;return saved}catch{return null}}
export function DataProvider({children}){
 const [dataset,setDataset]=useState(load)
 const [storageNotice,setStorageNotice]=useState('')
 const apply=(rows,name)=>{const next={rows,name,importedAt:new Date().toISOString()};setDataset(next);try{localStorage.setItem(storageKey,JSON.stringify(next));setStorageNotice('Saved in this browser.')}catch{try{localStorage.removeItem(storageKey)}catch{}setStorageNotice('Storage is full: this import is available for this session only.')}}
 const clear=()=>{setDataset(null);try{localStorage.removeItem(storageKey)}catch{}setStorageNotice('Imported browser data removed. Your original CSV is unchanged.')}
 return <Context.Provider value={{dataset,apply,clear,storageNotice}}>{children}</Context.Provider>
}
export const useData=()=>useContext(Context)
