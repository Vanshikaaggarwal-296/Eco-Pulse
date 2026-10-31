import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Leaf } from 'lucide-react'

// The native modal handles focus containment, Escape and background accessibility.
export function MenuNavigation({ groups, page, setPage }) {
  const dialog = useRef(null)
  const trigger = useRef(null)
  const navigating = useRef(false)
  const [phase, setPhase] = useState('closed')
  const active = phase !== 'closed'
  const [expanded, setExpanded] = useState(null)
  const [query, setQuery] = useState('')
  useEffect(() => { if(phase === 'closed'){setQuery('');setExpanded(null)} }, [phase])

  useEffect(() => {
    if (!active) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = oldOverflow }
  }, [active])

  useLayoutEffect(() => {
    const modal = dialog.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (phase === 'primed') {
      if (!modal.open) modal.showModal()
      // Commit the collapsed shape before expanding it on the next paint.
      modal.getBoundingClientRect()
      const frame = requestAnimationFrame(() => setPhase('opening'))
      return () => cancelAnimationFrame(frame)
    }
    if (phase === 'opening') {
      const timer = window.setTimeout(() => setPhase('open'), reduced ? 0 : 1050)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'closing') {
      const timer = window.setTimeout(() => {
        modal.close()
        setPhase('closed')
        if (navigating.current) document.querySelector('.section-title h1')?.focus({ preventScroll: true })
        else trigger.current?.focus({ preventScroll: true })
        navigating.current = false
      }, reduced ? 0 : 850)
      return () => window.clearTimeout(timer)
    }
  }, [phase])

  const close = () => { if (phase !== 'closed' && phase !== 'closing') setPhase('closing') }
  const navigate = id => {
    navigating.current = true
    setPage(id)
    close()
  }

  return <>
    <button ref={trigger} className="workspace-menu-trigger" aria-label="Open workspace menu" aria-haspopup="dialog" aria-expanded={active} aria-controls="ecopulse-menu" onClick={() => { if (!active) setPhase('primed') }}>
      <span className="menu-trigger-label">Menu</span><span className={`menu-bars ${active ? 'is-open' : ''}`} aria-hidden="true"><i/><i/></span>
    </button>
    {createPortal(<dialog ref={dialog} id="ecopulse-menu" className="workspace-menu" data-phase={phase} aria-labelledby="workspace-menu-title" onCancel={event => { event.preventDefault(); close() }} onClose={() => setPhase('closed')}>
      <section className="menu-brand-panel" aria-label="EcoPulse Energy Intelligence">
        <div className="menu-overlay-brand"><Leaf size={24}/><div><b>EcoPulse</b><span>ENERGY INTELLIGENCE</span></div></div>
        <div className="menu-campus-art" aria-hidden="true"><div className="art-building art-back"/><div className="art-building art-front"><Leaf size={70} strokeWidth={.8}/><span>ECOPULSE</span><small>CAMPUS ENERGY INTELLIGENCE</small></div><div className="art-ground"/></div>
        <div className="menu-brand-caption"><span>GREENFIELD CAMPUS</span><p>Smarter energy.<br/>Lighter footprint.</p></div>
      </section>
      <section className="menu-links-panel">
        <header className="menu-overlay-header"><span className="menu-current">WORKSPACE / {groups.flatMap(g=>g.items).find(i=>i[1]===page)?.[0]}</span><button className="workspace-menu-close" aria-label="Close workspace menu" autoFocus onClick={close}><span className="menu-bars menu-close-bars" aria-hidden="true"><i/><i/></span></button></header>
        <div className="menu-scroll-area">
          <h2 id="workspace-menu-title" className="sr-only">Explore EcoPulse</h2>
          <label className="menu-search"><span className="sr-only">Search sections</span><input type="search" placeholder="Search sections" value={query} onChange={e=>setQuery(e.target.value)}/><ArrowUpRight size={21}/></label>
          <nav className="menu-destinations" aria-label="Workspace sections">{groups.map((group, groupIndex) => {
            const items=group.items.filter(([label])=>label.toLowerCase().includes(query.trim().toLowerCase()))
            if(!items.length)return null
            const isExpanded=!!query.trim()||expanded===group.label
            const panelId=`menu-links-${groupIndex}`
            return <section className="menu-group" style={{'--group-delay':`${260+groupIndex*90}ms`}} key={group.label}>
              <button className="menu-group-toggle" aria-expanded={isExpanded} aria-controls={panelId} onClick={()=>setExpanded(isExpanded?null:group.label)}><span>{group.label==='WORKSPACE'?'Workspace':group.label==='ENERGY SYSTEMS'?'Energy systems':'Monitoring'}</span><i className={`menu-plus ${isExpanded?'expanded':''}`} aria-hidden="true"/></button>
              <div id={panelId} className={`menu-group-reveal ${isExpanded?'expanded':''}`} aria-hidden={!isExpanded} inert={!isExpanded?'':undefined}><div>
                {items.map(([label,id,Icon])=><button key={id} data-page={id} tabIndex={isExpanded?0:-1} className={`menu-destination ${page===id?'active':''}`} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}><Icon className="menu-link-icon" size={17}/><span className="menu-link-label">{label}</span>{id==='anomalies'&&<small className="menu-alert-count">2</small>}<ArrowUpRight className="menu-link-arrow" size={18}/></button>)}
              </div></div>
            </section>
          })}</nav>
          {query.trim()&&!groups.some(g=>g.items.some(([label])=>label.toLowerCase().includes(query.trim().toLowerCase())))&&<p className="menu-no-results" role="status">No matching sections.</p>}
          <p className="menu-local-note">Frontend preview · Demo AI screens</p>
        </div>
        <div className="menu-architecture-strip" aria-hidden="true"><i/><i/><i/></div>
      </section>
    </dialog>, document.body)}
  </>
}

const revealSelector = [
  '.eyebrow', 'h1', 'h3', 'p', '.metric-top', '.metric-value', '.metric-foot',
  '.chart-legend', '.chart-summary > div', '.mix-legend > div', '.insight',
  '.table-row', '.forecast-stats > div', '.model-score', '.model-row',
  '.recommendation', '.constraint', '.battery-visual', '.battery-stats > div',
  '.dispatch-row', '.zone-row', '.load-row', '.carbon-window', '.scenario-total',
  '.telemetry-card', '.critical-row', '.duration-result', '.anomaly-row',
  '.report-row', '.method', '.note-panel', '.safe-note', '.tip-banner', '.footer'
].join(',')

// Observe actual viewport intersections, including rows added by filters and tabs.
// Offscreen text stays unrevealed until scrolling reaches it. Content reveals once per visit.
export function RevealContent({ children, ...props }) {
  const root = useRef(null)
  useLayoutEffect(() => {
    const container = root.current
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let intersection
    let mutations
    const show = node => { node.dataset.reveal = 'shown'; intersection?.unobserve(node) }
    const setup = () => {
      intersection?.disconnect()
      mutations?.disconnect()
      if (media.matches || !('IntersectionObserver' in window)) {
        container.querySelectorAll(revealSelector).forEach(show)
        return
      }
      intersection = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        visible.forEach((entry, index) => {
          entry.target.style.setProperty('--reveal-delay', `${Math.min(index * 38, 228)}ms`)
          show(entry.target)
        })
      }, { threshold: .08, rootMargin: '0px 0px -28px 0px' })
      const register = () => container.querySelectorAll(revealSelector).forEach(node => {
        if (node.dataset.reveal === 'shown') return
        node.dataset.reveal = 'pending'
        intersection.observe(node)
      })
      register()
      mutations = new MutationObserver(register)
      mutations.observe(container, { childList: true, subtree: true })
    }
    setup()
    media.addEventListener('change', setup)
    const onFocus = event => {
      let node = event.target
      while (node && node !== container) {
        if (node.dataset?.reveal) show(node)
        node = node.parentElement
      }
    }
    container.addEventListener('focusin', onFocus)
    return () => { intersection?.disconnect(); mutations?.disconnect(); media.removeEventListener('change', setup); container.removeEventListener('focusin', onFocus) }
  }, [])
  return <div ref={root} {...props}>{children}</div>
}
