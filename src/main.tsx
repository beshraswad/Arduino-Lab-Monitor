import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, ArrowRight, ChevronDown, ChevronRight, CircuitBoard, Download, FlaskConical, Folder, Grip, Pencil, Play, Plus, Radio, Settings2, Square, Usb, Flag, Check, CircleHelp } from 'lucide-react'
import { channelsOf, csv, demoFrame, namedChannels, persist, projectValues, restore, TIME, uid, type Frame, type Project, type Run, type Sensor } from './model'
import { Chart, Thumbnail } from './visuals'
import { Modal, SensorEditor, TemplatePicker } from './editor'
import { useUsb } from './usb'
import './style.css'
import { createRoot } from 'react-dom/client'

type RawSample = {at:number; frame:Frame}
const WINDOW = 360
const STALE_MS = 6000
const clock = (at:number) => new Date(at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})
function App() {
  const [initial] = useState(()=>restore(localStorage))
  const [projects,setProjects] = useState(initial.projects)
  const [selected,setSelected] = useState(initial.selected)
  const project = projects.find(p=>p.id===selected)!
  const [tab,setTab] = useState<'setup'|'live'>('setup')
  const [usingDemo,setUsingDemo] = useState(true)
  const [baud,setBaud] = useState(115200)
  const [raw,setRaw] = useState<RawSample[]>([])
  const [fields,setFields] = useState<string[]>([])
  const [now,setNow] = useState(Date.now)
  const [origin,setOrigin] = useState(Date.now)
  const [runs,setRuns] = useState<Record<string,Run>>({})
  const run = runs[selected]
  const recording = !!run && run.end===undefined
  const [modal,setModal] = useState<'new'|'rename'|'templates'|'sensor'|'run'|'marker'|null>(null)
  const [draftName,setDraftName] = useState('')
  const [draftNotes,setDraftNotes] = useState('')
  const [draftSensor,setDraftSensor] = useState<Sensor>()
  const [saveError,setSaveError] = useState('')
  const [usbExpanded,setUsbExpanded] = useState(true)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const demoRef = useRef(false)
  const resetFeed = useCallback(()=>{
    setRaw([])
    setFields([])
    setOrigin(Date.now())
  },[])
  const ingest = useCallback((frame:Frame, at=Date.now(), record=true)=>{
    const id=selectedRef.current
    setRaw(prev=>prev.length>=WINDOW?[...prev.slice(1),{at,frame}]:[...prev,{at,frame}])
    setFields(prev=>{
      const added=Object.keys(frame).filter(key=>!prev.includes(key))
      return added.length ? [...prev,...added].sort() : prev
    })
    if (record) setRuns(prev=>{
      const r=prev[id]
      if (!r || r.end!==undefined || at<r.start) return prev
      return {...prev,[id]:{...r,samples:[...r.samples,{at,values:projectValues(frame,r.channels)}]}}
    })
  },[])
  const usb=useUsb(frame=>{if(!demoRef.current)ingest(frame)},()=>{
    if (demoRef.current) stopRun()
    demoRef.current=false
    setUsingDemo(false)
    resetFeed()
  })
  const demo=usingDemo?project.demo:undefined
  demoRef.current=!!demo
  useEffect(()=>{
    if (!demo) return
    resetFeed()
    const start=Date.now()-59_000
    setOrigin(start)
    let t=0
    for (;t<60;t++) ingest(demoFrame(demo,t),start+t*1000,false)
    const timer=window.setInterval(()=>ingest(demoFrame(demo,t++)),1000)
    return ()=>window.clearInterval(timer)
  },[selected,demo,resetFeed,ingest])
  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(Date.now()),1000)
    return ()=>window.clearInterval(timer)
  },[])
  useEffect(()=>{
    try { persist(localStorage,projects,selected);setSaveError('') }
    catch {setSaveError('Local storage is full or unavailable. Recent changes could not be saved.')}
  },[projects,selected])
  const modify=(fn:(p:Project)=>Project)=>setProjects(prev=>prev.map(p=>p.id===selected?fn(p):p))
  function stopRun(id=selected) {
    setRuns(prev=>{
      const r=prev[id]
      return r && r.end===undefined ? {...prev,[id]:{...r,end:Date.now()}} : prev
    })
  }
  function switchProject(id:string) {
    if(id===selected)return
    stopRun()
    resetFeed()
    selectedRef.current = id
    setSelected(id)
  }
  function startRun() {
    const start=Date.now()
    setRuns(prev=>({...prev,[selected]:{start,name:project.name+' run',notes:'',channels:namedChannels(project).map(c=>({...c,name:c.label})),samples:[],markers:[]}}))
  }
  function exportRun() {
    if(!run)return
    const url=URL.createObjectURL(new Blob([csv(run)],{type:'text/csv;charset=utf-8'}))
    const anchor=document.createElement('a')
    anchor.href=url
    anchor.download=(run.name.trim().replace(/[^\p{L}\p{N}_-]+/gu,'-')||'run')+'.csv'
    anchor.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function openText(type:'new'|'rename'|'run'|'marker') {
    setDraftName(type==='rename'?project.name:type==='run'?run?.name??'':'')
    setDraftNotes(type==='run'?run?.notes??'':'')
    setModal(type)
  }
  function submitText() {
    const name=draftName.trim()
    if(!name)return
    if(modal==='new') {
      const id=uid()
      setProjects(prev=>[...prev,{id,name,sensors:[],chart:{x:TIME,ys:[]}}])
      switchProject(id)
      setTab('setup')
    } else if(modal==='rename') modify(p=>({...p,name}))
    else if(modal==='run' || modal==='marker') {
      setRuns(prev=>{
        const r=prev[selected]
        if(!r || (modal==='marker'&&r.end!==undefined))return prev
        return {...prev,[selected]:modal==='run'?{...r,name,notes:draftNotes}:{...r,markers:[...r.markers,{at:Date.now(),name}]}}
      })
    }
    setModal(null)
  }
  const channels=channelsOf(project)
  const samples=raw.map(s=>({at:s.at,values:projectValues(s.frame,channels)}))
  const latest = new Map<string,{value:Frame[string];at:number}>()
  for(const sample of samples) for(const [id,value] of Object.entries(sample.values)) latest.set(id,{value,at:sample.at})
  const connected = !!demo || usb.status==='connected'
  const feedState = !connected?'Disconnected':!raw.length?'Waiting':now-raw[raw.length-1].at>STALE_MS?'Stale':'Live'
  const showValue=(id:string)=>{
    const reading=latest.get(id)
    if(!reading)return {value:'—',state:connected?'Waiting':'Disconnected'}
    const value=typeof reading.value==='number'?Number(reading.value.toFixed(2)).toString():String(reading.value)
    return {value,state:!connected?'Disconnected':now-reading.at>STALE_MS?'Stale':'Live'}
  }
  const configure=(sensor:Sensor)=>{setDraftSensor(sensor);setModal('sensor')}
  function saveSensor(sensor:Sensor) {
    modify(p=>{
      const sensors=p.sensors.some(s=>s.id===sensor.id)?p.sensors.map(s=>s.id===sensor.id?sensor:s):[...p.sensors,sensor]
      const first=sensor.channels.find(c=>c.kind==='number')
      return {...p,sensors,chart:p.chart.ys.length||!first?p.chart:{x:TIME,ys:[first.id]}}
    })
    setModal(null)
  }
  const chartSamples = recording && run ? samples.filter(s=>s.at>=run.start) : samples
  const chartStart = recording && run ? run.start : origin
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><CircuitBoard size={24}/></div><div><strong>Arduino<span>.</span></strong><small>LAB MONITOR</small></div></div>
      <div className="side-main">
        <div className="side-label"><span>PROJECTS</span><button className="icon-button" aria-label="New project" onClick={()=>openText('new')}><Plus size={18}/></button></div>
        <div className="projects">{projects.map(p=><button key={p.id} className={'project-button '+(p.id===selected?'active':'')} aria-current={p.id===selected?'page':undefined} onClick={()=>switchProject(p.id)}>
          {p.demo?<FlaskConical size={17}/>:<Folder size={17}/>}<span>{p.name}</span>{p.demo&&<small>DEMO</small>}
        </button>)}</div>
        <button className="new-project" onClick={()=>openText('new')}><Plus size={16}/> New project</button>
      </div>
      <div className="side-bottom">
        <div className="usb-box">
          <button className="usb-heading" aria-expanded={usbExpanded} onClick={()=>setUsbExpanded(v=>!v)}><Usb size={17}/><strong>USB connection</strong><ChevronDown size={15} className={usbExpanded?'':'closed'}/></button>
          <div className="usb-status"><i className={usb.status==='connected'?'online':''}/>{({connected:'Connected',disconnected:'Disconnected',connecting:'Connecting…',closing:'Disconnecting…'})[usb.status]}</div>
          {usbExpanded&&<>
            <label>Baud rate<select value={baud} disabled={usb.status!=='disconnected'} onChange={e=>setBaud(Number(e.target.value))}>{[9600,19200,38400,57600,115200,230400,460800,921600].map(n=><option key={n}>{n}</option>)}</select></label>
            <button className="button usb-button" disabled={!usb.supported||usb.status==='connecting'||usb.status==='closing'} onClick={()=>usb.status==='connected'?usb.disconnect():void usb.connect(baud)}><Usb size={15}/>{usb.status==='connected'?'Disconnect':'Connect USB'}</button>
            {!usb.supported&&<p className="muted usb-help">Open localhost in desktop Chrome for USB.</p>}
            {usb.error&&<p className="error usb-help" role="status">{usb.error}</p>}
            {usb.invalid>0&&<p className="muted usb-help">{usb.invalid} invalid serial lines or read errors</p>}
          </>}
        </div>
        <div className="side-foot"><CircleHelp size={14}/> Local workspace <span>v1.0</span></div>
      </div>
    </aside>
    <main>
      <header className="topbar"><div className="breadcrumb"><Grip size={16}/><span>Workspace</span><ChevronRight size={13}/><strong>{project.name}</strong></div><span className={'save-indicator '+(saveError?'error':'')} title={saveError||undefined}>{saveError?'Save failed':<><Check size={14}/> Saved locally</>}</span></header>
      <div className="main-content">
        {saveError&&<p className="error" role="alert">{saveError}</p>}
        <div className="hero"><div><div className="eyebrow"><span/> LAB WORKSPACE</div><div className="title-row"><h1>{project.name}</h1><button className="icon-button rename" title="Rename project" aria-label="Rename project" onClick={()=>openText('rename')}><Pencil size={16}/></button></div><p>{project.demo==='mist'?'Monitor airflow conditions and pump performance.':project.demo==='flow'?'Compare flow rate and differential pressure.':'Configure your sensors and monitor incoming measurements.'}</p></div>
          {project.demo&&<button className={'button demo-button '+(demo?'demo-active':'')} disabled={usb.status!=='disconnected'} onClick={()=>{stopRun();resetFeed();setUsingDemo(v=>!v)}}><FlaskConical size={16}/>{demo?'Demo mode':'Play demo'}{demo&&<i/>}</button>}
        </div>
        <div className="tabs" aria-label="Project views">
          <button className={tab==='setup'?'current':''} aria-pressed={tab==='setup'} onClick={()=>setTab('setup')}><Settings2 size={17}/> Setup</button>
          <button className={tab==='live'?'current':''} aria-pressed={tab==='live'} onClick={()=>setTab('live')}><Activity size={17}/> Live View</button>
          <span className={'feed-state '+feedState.toLowerCase()}><i/>{demo&&feedState==='Live'?'Demo feed active':feedState}</span>
        </div>
        {tab==='setup'?<div className="setup-grid">
          <section className="panel sensors-panel"><div className="panel-heading"><div><h2>Sensors <span className="count">{project.sensors.length}</span></h2><p>Manage devices and map their data channels.</p></div><button className="primary button" onClick={()=>setModal('templates')}><Plus size={16}/> Add sensor</button></div>
            <div className="sensor-grid">{project.sensors.map(sensor=><button className="sensor-tile" key={sensor.id} onClick={()=>configure(sensor)}><Thumbnail sensor={sensor}/><span className="tile-info"><strong>{sensor.name}</strong><small>{sensor.location||'No location set'}</small><span className="tile-channels">{sensor.channels.length} {sensor.channels.length===1?'channel':'channels'}</span></span><Pencil className="tile-edit" size={13}/></button>)}</div>
            {!project.sensors.length&&<div className="empty-sensors"><CircuitBoard size={28}/><h3>No sensors configured</h3><p>Add a sensor and map its fields to get started.</p></div>}
            <div className="panel-footer"><Radio size={14}/><span>{fields.length} serial {fields.length===1?'field':'fields'} detected</span><span className="grow"/><span>{channels.length} configured channels</span></div>
          </section>
          <div className="preview-column">
            <Chart project={project} samples={samples} markers={[]} start={origin} compact/>
            <button className="preview-link" onClick={()=>setTab('live')}><span><Activity size={17}/> Open Live View</span><ArrowRight size={17}/></button>
          </div>
        </div>:<div className="live-stack">
          <section className="panel readings-panel"><div className="panel-heading"><div><h2>Sensor readings</h2><p>Latest values for this project.</p></div><span className="tag">{demo?'Simulated data':'USB serial'}</span></div>
            <div className="readings-grid">{project.sensors.map(s=><article className="reading" key={s.id}><div className="reading-heading"><Thumbnail sensor={s}/><div><h3>{s.name}</h3><p>{s.location||'No location set'}</p></div></div>
              {s.channels.map(c=>{const reading=showValue(c.id);return <div className="reading-channel" key={c.id}><div><small>{c.name}{c.calc?' · Calculated':''}</small><strong>{reading.value} <small>{c.unit}</small></strong></div><span className={'feed-state '+reading.state.toLowerCase()}><i/>{reading.state}</span></div>})}
            </article>)}</div>
            {!project.sensors.length&&<p className="muted">Add sensors in Setup to display readings.</p>}
          </section>
          <Chart project={project} samples={chartSamples} markers={run?.markers??[]} start={chartStart} onChange={chart=>modify(p=>({...p,chart}))}/>
          <section className="panel run-panel"><div className="panel-heading"><div><h2>Run recording</h2><p>{run?run.name+' · '+run.samples.length+' samples · '+(recording?'Recording':'Stopped'):'Record sensor samples and add timestamped notes.'}</p></div>{recording?<button className="button danger" onClick={()=>stopRun()}><Square size={14}/> Stop run</button>:<button className="button primary" onClick={()=>startRun()}><Play size={15}/>{run?'Start new run':'Start run'}</button>}</div>
            {run&&<><div className="run-actions"><button className="button" disabled={!recording} onClick={()=>openText('marker')}><Flag size={14}/> Add marker</button><button className="button" onClick={()=>openText('run')}><Pencil size={14}/> Edit metadata</button><button className="button" onClick={exportRun}><Download size={15}/> Export CSV</button></div>
              {run.notes&&<p className="run-notes">{run.notes}</p>}
              {!!run.markers.length&&<ul className="markers">{run.markers.map((m,i)=><li key={i}><Flag size={13}/><time dateTime={new Date(m.at).toISOString()}>{clock(m.at)}</time><span>{m.name}</span></li>)}</ul>}
            </>}
          </section>
        </div>}
        <footer className="main-footer"><span><CircuitBoard size={14}/> Arduino Lab Monitor</span><span>READ-ONLY TELEMETRY</span></footer>
      </div>
    </main>
    {modal==='templates'&&<TemplatePicker pick={configure} close={()=>setModal(null)}/>}
    {modal==='sensor'&&draftSensor&&<SensorEditor key={draftSensor.id} sensor={draftSensor} project={project} fields={fields} save={saveSensor} close={()=>setModal(null)} remove={project.sensors.some(s=>s.id===draftSensor.id)?()=>{
      modify(p=>{
        const removed=new Set(draftSensor.channels.map(c=>c.id))
        return {...p,sensors:p.sensors.filter(s=>s.id!==draftSensor.id),chart:{x:removed.has(p.chart.x)?TIME:p.chart.x,ys:p.chart.ys.filter(y=>!removed.has(y))}}
      })
      setModal(null)
    }:undefined}/>}
    {modal&&['new','rename','run','marker'].includes(modal)&&<Modal title={{new:'New project',rename:'Rename project',run:'Edit run metadata',marker:'Add event marker'}[modal as 'new']} close={()=>setModal(null)}>
      <form onSubmit={e=>{e.preventDefault();submitText()}}><label>{modal==='marker'?'Event name':modal==='run'?'Run name':'Project name'}<input autoFocus required value={draftName} onChange={e=>setDraftName(e.target.value)}/></label>
      {modal==='run'&&<label className="notes-label">Notes<textarea rows={4} value={draftNotes} onChange={e=>setDraftNotes(e.target.value)}/></label>}
      <div className="dialog-actions"><div className="grow"/><button type="button" className="button" onClick={()=>setModal(null)}>Cancel</button><button className="primary button">{modal==='new'?'Create project':modal==='marker'?'Add marker':'Save changes'}</button></div></form>
    </Modal>}
  </div>
}
createRoot(document.getElementById('root')!).render(<App />)

