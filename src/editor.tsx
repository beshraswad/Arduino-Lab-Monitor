import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { channelsOf, makeChannel, makeSensor, namedChannels, templates, type Channel, type Project, type Sensor, type Template } from './model'
import { Thumbnail, sensorIcons } from './visuals'

export function Modal({title, children, close}: {title:string; children:ReactNode; close:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(()=>{ref.current?.showModal()},[])
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===ref.current) close()}}>
    <div className="dialog-content"><div className="dialog-title"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20}/></button></div>{children}</div>
  </dialog>
}
export function TemplatePicker({pick,close}:{pick:(sensor:Sensor)=>void;close:()=>void}) {
  return <Modal title="Add a sensor" close={close}><p className="muted">Choose a template. You can add multiple sensors of any type.</p><div className="template-grid">{Object.entries(templates).map(([id,t])=>{
    const Icon=sensorIcons[id as Template]
    return <button key={id} onClick={()=>pick(makeSensor(id as Template))}><Icon size={20}/><span>{t.name}</span></button>
  })}</div></Modal>
}
export function SensorEditor({sensor,project,fields,save,remove,close}: {sensor:Sensor;project:Project;fields:string[];save:(s:Sensor)=>void;remove?:()=>void;close:()=>void}) {
  const [draft,setDraft]=useState(sensor)
  const [photoError,setPhotoError]=useState('')
  const [confirmRemove,setConfirmRemove]=useState(false)
  const update=(id:string,props:Partial<Channel>)=>setDraft(s=>({...s,channels:s.channels.map(c=>c.id===id?{...c,...props}:c)}))
  const configured={...project,sensors:[...project.sensors.filter(s=>s.id!==draft.id),draft]}
  const choices=namedChannels(configured).filter(c=>c.kind==='number'&&!c.calc)
  const valid=draft.channels.every(c=>!c.calc || (c.calc[0]!==c.calc[1] && c.calc.every(id=>choices.some(choice=>choice.id===id&&choice.id!==c.id&&choice.unit===c.unit))))
  async function readPhoto(file:File) {
    setPhotoError('')
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size>600_000) {
      setPhotoError('Choose a PNG, JPEG, WebP, or GIF under 600 KB.');return
    }
    const reader=new FileReader()
    reader.onload=()=>setDraft(s=>({...s,photo:String(reader.result)}))
    reader.onerror=()=>setPhotoError('Could not read this image.')
    reader.readAsDataURL(file)
  }
  return <Modal title={remove?'Edit sensor':'Configure sensor'} close={close}>
    <form onSubmit={e=>{e.preventDefault();if(draft.name.trim()&&valid)save({...draft,name:draft.name.trim(),channels:draft.channels.map(c=>({...c,field:c.field.trim(),name:c.name.trim()||'Value'}))})}}>
      <div className="editor-top"><Thumbnail sensor={draft}/><div className="editor-photo"><label className="button photo-upload"><ImagePlus size={15}/> {draft.photo?'Replace photo':'Upload photo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const file=e.target.files?.[0];if(file)void readPhoto(file)}}/></label>{draft.photo&&<button type="button" className="text-button" onClick={()=>setDraft(s=>({...s,photo:undefined}))}>Remove photo</button>}{photoError&&<p className="error">{photoError}</p>}</div></div>
      <div className="form-grid"><label>Sensor name<input required value={draft.name} onChange={e=>setDraft(s=>({...s,name:e.target.value}))}/></label><label>Location<input placeholder="e.g. Supply line" value={draft.location} onChange={e=>setDraft(s=>({...s,location:e.target.value}))}/></label></div>
      <div className="editor-subhead"><h3>Channels</h3><button type="button" className="button" onClick={()=>setDraft(s=>({...s,channels:[...s.channels,makeChannel()]}))}><Plus size={14}/> Add channel</button></div>
      <datalist id="detected-fields">{fields.map(field=><option key={field} value={field}/>)}</datalist>
      {draft.channels.map((c,index)=><div className="channel-editor" key={c.id}>
        <div className="channel-heading"><span>Channel {index+1}</span><button type="button" className="icon-button" aria-label={'Remove channel '+c.name} disabled={draft.channels.length===1} onClick={()=>setDraft(s=>({...s,channels:s.channels.filter(ch=>ch.id!==c.id)}))}><Trash2 size={15}/></button></div>
        <div className="form-grid channel-fields">
          <label>Channel name<input required value={c.name} onChange={e=>update(c.id,{name:e.target.value})}/></label>
          <label>Units<input placeholder="e.g. L/min" value={c.unit} readOnly={!!c.calc} onChange={e=>update(c.id,{unit:e.target.value})}/></label>
          <label>Source<select value={c.calc?'calc':c.kind} onChange={e=>update(c.id,e.target.value==='calc'?{kind:'number',calc:['',''],unit:''}:{kind:e.target.value as Channel['kind'],calc:undefined})}><option value="number">Numeric field</option><option value="status">Status field</option><option value="calc">Subtract channels</option></select></label>
          {!c.calc && <label>Serial field<input list="detected-fields" placeholder="Type or select a field" value={c.field} onChange={e=>update(c.id,{field:e.target.value})}/></label>}
          {!c.calc && fields.length>0 && <label>Detected fields<select value="" onChange={e=>{if(e.target.value)update(c.id,{field:e.target.value})}}><option value="">Choose detected field</option>{fields.map(f=><option key={f}>{f}</option>)}</select></label>}
        </div>
        {c.calc && <div className="form-grid calc-fields">
          <label>First channel<select value={c.calc[0]} onChange={e=>update(c.id,{calc:[e.target.value,''],unit:choices.find(ch=>ch.id===e.target.value)?.unit??''})}><option value="">Select channel</option>{choices.filter(ch=>ch.id!==c.id).map(ch=><option key={ch.id} value={ch.id}>{ch.label} ({ch.unit||'unitless'})</option>)}</select></label>
          <label>Subtract<select value={c.calc[1]} onChange={e=>update(c.id,{calc:[c.calc![0],e.target.value]})}><option value="">Select matching units</option>{choices.filter(ch=>ch.id!==c.id&&ch.id!==c.calc![0]&&ch.unit===c.unit).map(ch=><option key={ch.id} value={ch.id}>{ch.label} ({ch.unit||'unitless'})</option>)}</select></label>
        </div>}
      </div>)}
      {!valid&&<p className="error">Select two different numeric source channels with matching units.</p>}
      {remove && channelsOf(project).some(c=>c.calc?.some(id=>sensor.channels.some(ch=>ch.id===id))) && <p className="muted">Other calculated channels reference this sensor.</p>}
      <div className="dialog-actions">{remove&&<button type="button" className="button danger" onClick={()=>confirmRemove?remove():setConfirmRemove(true)}>{confirmRemove?'Confirm removal':'Remove sensor'}</button>}<div className="grow"/><button type="button" className="button" onClick={close}>Cancel</button><button className="primary button" disabled={!valid}>Save sensor</button></div>
    </form>
  </Modal>
}
