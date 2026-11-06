import { Activity, Aperture, Droplets, Gauge, Radio, Thermometer, ToggleLeft, Zap } from 'lucide-react'
import { useId } from 'react'
import { TIME, seriesPoints, namedChannels, type Project, type Sample, type Marker, type Sensor } from './model'

export const sensorIcons = {climate:Thermometer,probe:Thermometer,flow:Droplets,pressure:Gauge,distance:Radio,electrical:Zap,status:ToggleLeft,custom:Aperture}
export function Thumbnail({sensor}: {sensor:Sensor}) {
  const id = useId()
  if (sensor.photo) return <div className="thumbnail"><img src={sensor.photo} alt="" /></div>
  const Icon = sensorIcons[sensor.template as keyof typeof sensorIcons] ?? Activity
  return <div className={'thumbnail thumb-'+sensor.template}>
    {sensor.template === 'climate' ? <svg viewBox="0 0 92 68" aria-hidden="true">
      <defs><linearGradient id={id} x2="1" y2="1"><stop stopColor="#f0f3ee"/><stop offset="1" stopColor="#95a5a3"/></linearGradient></defs>
      <g transform="translate(46 33) rotate(-14)">
        <rect x="-19" y="-24" width="38" height="50" rx="5" fill="#163e3e"/><rect x="-15" y="-21" width="31" height="39" rx="3" fill={'url(#'+id+')'}/>
        {Array.from({length:6},(_,i)=><rect key={i} x="-10" y={-16+i*5} width="21" height="2.7" rx="1" fill="#455a60"/>)}
        {[-7,0,7].map(x=><path key={x} d={'M'+x+' 19v12'} stroke="#c8a875" strokeWidth="2"/>)}
      </g>
    </svg> : sensor.template === 'distance' ? <svg viewBox="0 0 92 68" aria-hidden="true"><g transform="translate(46 33) rotate(-10)"><rect x="-33" y="-16" width="66" height="32" rx="3" fill="#174a7c" stroke="#326b9b"/>{[-17,17].map(x=><g key={x}><circle cx={x} r="13" fill="#a8b8c4"/><circle cx={x} r="9" fill="#44586d"/><circle cx={x} r="6" fill="#283744"/></g>)}<path d="M-6 16v7m4-7v7m4-7v7m4-7v7" stroke="#d0b280" strokeWidth="1.5"/></g></svg> : sensor.template === 'electrical' ? <svg viewBox="0 0 92 68" aria-hidden="true"><g transform="translate(46 34) rotate(-13)"><rect x="-31" y="-15" width="62" height="30" rx="3" fill="#24534b" stroke="#3c7b69"/><rect x="-26" y="-11" width="23" height="22" rx="2" fill="#377ccc"/><circle cx="-20" cy="0" r="4" fill="#b3c5d6"/><circle cx="-10" cy="0" r="4" fill="#b3c5d6"/><rect x="4" y="-6" width="14" height="12" rx="1" fill="#17252c"/><path d="M24 -6h13m-13 6h13m-13 6h13" stroke="#c8ae7a" strokeWidth="2"/></g></svg> : <Icon size={31} strokeWidth={1.45}/>}
  </div>
}

const palette = ['#35d7c2','#8799ff','#f5ae5b','#ef86bd','#90dc6f']
const formatTick = (n: number) => Number(n.toPrecision(4)).toString()
export function Chart({project, samples, markers, start, onChange, compact = false}: {project:Project; samples:Sample[]; markers:Marker[]; start:number; onChange?:(chart:Project['chart'])=>void; compact?:boolean}) {
  const channels = namedChannels(project).filter(c=>c.kind==='number')
  const {x,ys} = project.chart
  const xChannel = channels.find(c=>c.id===x)
  const xAxis = xChannel ? x : TIME
  const yOptions = [{id:TIME,label:'Elapsed time',unit:'s'},...channels]
  const primary = yOptions.find(c=>c.id===ys[0])
  const selections = primary ? yOptions.filter(c=>ys.includes(c.id) && c.unit===primary.unit && (xAxis===TIME || c.id===primary.id)).sort((a,b)=>ys.indexOf(a.id)-ys.indexOf(b.id)) : []
  const series = selections.map((c,i)=>({...c,color:palette[i%palette.length],points:seriesPoints(samples,xAxis,c.id,start)}))
  const pointCount = series.reduce((sum,s)=>sum+s.points.length,0)
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity
  for (const s of series) for (const p of s.points) {
    minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x)
    minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)
  }
  if (!pointCount) { minX=0;maxX=60;minY=0;maxY=10 }
  const padY=(maxY-minY)*.13 || Math.max(Math.abs(minY)*.05,1)
  minY-=padY;maxY+=padY
  if (minX===maxX) { minX-=1;maxX+=1 }
  const width=compact?500:920, height=compact?240:350, left=62,right=width-21,top=17,bottom=height-53
  const px=(n:number)=>left+(n-minX)/(maxX-minX)*(right-left)
  const py=(n:number)=>bottom-(n-minY)/(maxY-minY)*(bottom-top)
  const ticks=Array.from({length:5},(_,i)=>i/4)
  const gradient = useId()
  const xLabel=xChannel ? xChannel.label+(xChannel.unit?' ('+xChannel.unit+')':'') : 'Elapsed time (s)'
  const yLabel=primary ? (selections.length>1 ? primary.unit || 'Value' : primary.label+(primary.unit?' ('+primary.unit+')':'')) : 'Value'
  return <section className="panel chart-panel" aria-label="Live chart">
    <div className="panel-heading"><div><h2>{compact?'Live preview':'Live chart'}</h2><p>{compact?'A quick look at incoming sensor data.':'Choose the channels to compare.'}</p></div><span className="tag"><Activity size={13}/>{xAxis===TIME?'Line chart':'Scatter plot'}</span></div>
    {onChange && <div className="axis-controls">
      <label>X axis<select value={xAxis} onChange={e=>onChange({x:e.target.value,ys:e.target.value===TIME?ys:ys.slice(0,1)})}><option value={TIME}>Elapsed time (s)</option>{channels.map(c=><option key={c.id} value={c.id}>{c.label}{c.unit?' ('+c.unit+')':''}</option>)}</select></label>
      <label>Y axis<select value={primary?.id ?? ''} onChange={e=>onChange({x:xAxis,ys:e.target.value?[e.target.value]:[]})}><option value="">Select a channel</option>{yOptions.map(c=><option key={c.id} value={c.id}>{c.label}{c.unit?' ('+c.unit+')':''}</option>)}</select></label>
      {xAxis===TIME && primary && yOptions.some(c=>c.id!==primary.id && c.unit===primary.unit) && <label>Add Y channel<select value="" onChange={e=>e.target.value&&onChange({x:xAxis,ys:[...ys,e.target.value]})}><option value="">Same-unit channels</option>{yOptions.filter(c=>!ys.includes(c.id)&&c.unit===primary.unit).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
    </div>}
    <div className="chart-surface">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${xAxis===TIME?'Line chart':'Scatter plot'} of ${yLabel} versus ${xLabel}, ${pointCount} plotted points`}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#35d7c2" stopOpacity=".23"/><stop offset="1" stopColor="#35d7c2" stopOpacity="0"/></linearGradient></defs>
        {ticks.map(t=><g key={t}><path d={`M${left} ${top+t*(bottom-top)}H${right} M${left+t*(right-left)} ${top}V${bottom}`} stroke="#223043" strokeDasharray="3 4"/><text x={left-9} y={top+t*(bottom-top)+4} textAnchor="end">{formatTick(maxY-t*(maxY-minY))}</text><text x={left+t*(right-left)} y={bottom+19} textAnchor="middle">{formatTick(minX+t*(maxX-minX))}</text></g>)}
        <text x={(left+right)/2} y={height-9} textAnchor="middle">{xLabel}</text>
        <text transform={`translate(13 ${(top+bottom)/2}) rotate(-90)`} textAnchor="middle">{compact && selections.length>1 ? primary?.unit : yLabel}</text>
        {xAxis===TIME && markers.map((marker,i)=>{const x=(marker.at-start)/1000; return x<minX||x>maxX?null:<path key={i} d={`M${px(x)} ${top}V${bottom}`} stroke="#f5ae5b" strokeDasharray="5 4"><title>{marker.name}</title></path>})}
        {series.map((s,i)=>{
          const points=s.points
          if (xAxis!==TIME || points.length===1) return <g key={s.id}>{points.map((p,j)=><circle key={j} cx={px(p.x)} cy={py(p.y)} r={3} fill={s.color} opacity=".82"><title>{s.label}: {formatTick(p.y)} at {formatTick(p.x)}</title></circle>)}</g>
          if (!points.length) return null
          const path=points.map((p,j)=>(j?'L':'M')+px(p.x)+','+py(p.y)).join(' ')
          return <g key={s.id}>{i===0&&<path d={`${path} L${px(points.at(-1)!.x)},${bottom} L${px(points[0].x)},${bottom} Z`} fill={'url(#'+gradient+')'}/>}<path d={path} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></g>
        })}
      </svg>
      {!pointCount && <div className="chart-empty">Waiting for paired numeric samples</div>}
    </div>
    {series.length>0 && <div className="legend">{series.map((s,i)=><span key={s.id}><i style={{background:s.color}}/>{s.label}{onChange&&i>0&&<button className="legend-remove" aria-label={'Remove '+s.label} onClick={()=>onChange({x,ys:ys.filter(id=>id!==s.id)})}>×</button>}</span>)}</div>}
  </section>
}
