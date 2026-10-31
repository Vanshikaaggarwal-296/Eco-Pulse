import React, {useEffect, useState} from 'react'

export default function ApiStatus() {
  const [state,setState]=useState('checking')
  useEffect(()=>{
    let stopped=false
    const controllers=new Set()
    const check=async()=>{
      const controller=new AbortController()
      controllers.add(controller)
      const timeout=setTimeout(()=>controller.abort(),4000)
      try {
        const base=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'')
        const response=await fetch(`${base}/api/health`,{signal:controller.signal})
        if(!response.ok)throw new Error('Health check failed')
        const health=await response.json()
        if(!stopped)setState(health.status==='ok'?'connected':'offline')
      } catch {if(!stopped)setState('offline')}
      finally{clearTimeout(timeout);controllers.delete(controller)}
    }
    check()
    const timer=setInterval(check,30000)
    return()=>{stopped=true;clearInterval(timer);controllers.forEach(c=>c.abort())}
  },[])
  const label=state==='connected'?'API connected':state==='offline'?'API offline':'Checking API'
  return <div className={`system-pill api-status ${state}`} role="status" title="Backend health only. Demo screens and browser CSV imports remain labelled separately."><span className="live-dot"/>{label}</div>
}
