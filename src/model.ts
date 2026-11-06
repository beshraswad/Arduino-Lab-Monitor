export type Value = number | string | boolean
export type Frame = Record<string, Value>
export type Channel = { id: string; name: string; unit: string; field: string; kind: 'number' | 'status'; calc?: [string, string] }
export type Sensor = { id: string; template: string; name: string; location: string; photo?: string; channels: Channel[] }
export type Project = { id: string; name: string; demo?: 'mist' | 'flow'; sensors: Sensor[]; chart: { x: string; ys: string[] } }
export type Sample = { at: number; values: Frame }
export type Marker = { at: number; name: string }
export type Run = { start: number; end?: number; name: string; notes: string; channels: Channel[]; samples: Sample[]; markers: Marker[] }
export const TIME = 'time'
export const uid = () => crypto.randomUUID()
export const templates = {
  climate: { name: 'Temperature / RH', channels: [['Temperature','°C'],['Humidity','% RH']] },
  probe: { name: 'Temperature probe', channels: [['Temperature','°C']] },
  flow: { name: 'Flow', channels: [['Flow','L/min']] },
  pressure: { name: 'Pressure', channels: [['Pressure','kPa']] },
  distance: { name: 'Distance', channels: [['Distance','cm']] },
  electrical: { name: 'Electrical', channels: [['Current','A'],['Voltage','V'],['Measured power','W']] },
  status: { name: 'Switch / status', channels: [['Status','']] },
  custom: { name: 'Custom', channels: [['Value','']] },
}
export type Template = keyof typeof templates
export const makeChannel = (name = 'Value', unit = '', kind: Channel['kind'] = 'number'): Channel => ({id:uid(), name, unit, field:'', kind})
export function makeSensor(template: Template): Sensor {
  const config = templates[template]
  return { id:uid(), template, name:config.name, location:'', channels:config.channels.map(([name,unit]) => makeChannel(name,unit,template === 'status' ? 'status' : 'number')) }
}
export const channelsOf = (project: Project) => project.sensors.flatMap(sensor => sensor.channels)
export const namedChannels = (project: Project) => project.sensors.flatMap(sensor => sensor.channels.map(channel => ({...channel, label: sensor.channels.length > 1 ? sensor.name + ' · ' + channel.name : sensor.name === channel.name ? channel.name : sensor.name + ' · ' + channel.name})))
function demoSensor(template: Template, id: string, name: string, location: string, fields: string[]): Sensor {
  return { id, template, name, location, channels: templates[template].channels.slice(0, fields.length).map(([name,unit], i) => ({id:id+'-'+i,name,unit,field:fields[i],kind:'number'})) }
}
const mist: Project = {
  id:'demo-mist', name:'Condenser Misting', demo:'mist',
  sensors:[
    demoSensor('climate','inlet','Inlet Air','Condenser intake',['inlet_temp_c','inlet_rh']),
    demoSensor('climate','outlet','Outlet Air','Condenser exhaust',['outlet_temp_c','outlet_rh']),
    demoSensor('climate','ambient','Ambient Air','Test area',['ambient_temp_c','ambient_rh']),
    demoSensor('climate','mist','Mist Zone','Spray chamber',['mist_temp_c','mist_rh']),
    demoSensor('distance','tank','Water Level','Reservoir',['tank_distance_cm']),
    demoSensor('electrical','pump','Pump Current','Pump supply',['pump_current_a'])
  ],
  chart:{x:TIME,ys:['inlet-0','outlet-0']}
}
const flow: Project = {
  id:'demo-flow',name:'Flow Bench',demo:'flow',
  sensors:[
    demoSensor('flow','flow','Bench Flow','Supply line',['flow_lpm']),
    demoSensor('pressure','upstream','Upstream Pressure','Before test section',['upstream_kpa']),
    demoSensor('pressure','downstream','Downstream Pressure','After test section',['downstream_kpa']),
    { id:'drop',template:'custom',name:'Pressure Drop',location:'Across test section',channels:[{id:'delta-p',name:'ΔP',unit:'kPa',field:'',kind:'number',calc:['upstream-0','downstream-0']}] }
  ], chart:{x:TIME,ys:['upstream-0','downstream-0']}
}
const storageKey = 'arduino-lab-monitor.v1'
export const defaults = () => structuredClone([mist,flow])
export function restore(storage: Pick<Storage,'getItem'>): {projects:Project[]; selected:string} {
  try {
    const saved = JSON.parse(storage.getItem(storageKey) ?? 'null')
    if (Array.isArray(saved?.projects) && saved.projects.length && saved.projects.every((p:Project) => p.id && Array.isArray(p.sensors) && Array.isArray(p.chart?.ys))) {
      return {projects:saved.projects, selected:saved.projects.some((p:Project) => p.id === saved.selected) ? saved.selected : saved.projects[0].id}
    }
  } catch { /* Recover from unavailable or invalid saved data. */ }
  return {projects:defaults(),selected:mist.id}
}
export function persist(storage: Pick<Storage,'setItem'>, projects:Project[], selected:string) {
  storage.setItem(storageKey,JSON.stringify({projects,selected}))
}
export function demoFrame(demo: NonNullable<Project['demo']>, t: number): Frame {
  const wave = Math.sin(t / 8)
  const ripple = Math.sin(t * 1.37) * 0.19 + Math.cos(t * 0.81) * 0.13
  if (demo === 'flow') {
    const rate = 2.7 + 1.35 * wave + ripple
    return { flow_lpm:rate, upstream_kpa:24 + 8 * rate + ripple, downstream_kpa:24 + 8 * rate - 1.75 * rate ** 2 }
  }
  return {inlet_temp_c:42.6 + wave * 1.2 + ripple, inlet_rh:38 + 2 * wave,
    outlet_temp_c:33.4 + Math.sin(t / 9 + 1) * 1.2 + ripple, outlet_rh:58 + 3 * wave,
    ambient_temp_c:29.8 + wave * .4, ambient_rh:45 + wave,
    mist_temp_c:27.5 + wave * .7, mist_rh:76 + 2 * wave,
    tank_distance_cm:14.5 + wave * .45, pump_current_a:1.24 + ripple / 5}
}
export function projectValues(frame: Frame, channels: Channel[]): Frame {
  const result: Frame = Object.create(null)
  const byId = new Map(channels.map(channel => [channel.id, channel]))
  const resolved = new Set<string>()
  const active = new Set<string>()
  function resolve(id: string): Value | undefined {
    if (resolved.has(id)) return result[id]
    const channel = byId.get(id)
    if (!channel || active.has(id)) return
    active.add(id)
    if (channel.calc) {
      const [a,b] = channel.calc
      const left = byId.get(a), right = byId.get(b)
      if (a !== b && left?.kind === 'number' && right?.kind === 'number' && left.unit === right.unit && left.unit === channel.unit) {
        const x = resolve(a), y = resolve(b)
        if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x-y)) result[id] = x-y
      }
    } else if (channel.field && Object.hasOwn(frame, channel.field)) {
      const value = frame[channel.field]
      if (channel.kind === 'status' || (typeof value === 'number' && Number.isFinite(value))) result[id] = value
    }
    active.delete(id)
    resolved.add(id)
    return result[id]
  }
  channels.forEach(channel => resolve(channel.id))
  return result
}
export function seriesPoints(samples: Sample[], x: string, y: string, start: number) {
  return samples.flatMap(sample => {
    const axis = (id: string) => id === TIME ? (sample.at-start)/1000 : sample.values[id]
    const xv = axis(x), yv = axis(y)
    return typeof xv === 'number' && typeof yv === 'number' && Number.isFinite(xv) && Number.isFinite(yv) ? [{x:xv,y:yv}] : []
  })
}
export function csv(run: Run): string {
  const row = (cells: (string | number | boolean | undefined)[]) => cells.map(cell => {
    const s = String(cell ?? '')
    return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"','""') + '"' : s
  }).join(',')
  return [
    row(['timestamp','elapsed_s',...run.channels.map(c => c.name + (c.unit ? ' ['+c.unit+']' : ''))]),
    ...run.samples.map(sample => row([new Date(sample.at).toISOString(), ((sample.at-run.start)/1000).toFixed(3), ...run.channels.map(c => sample.values[c.id])])),
  ].join('\r\n') + '\r\n'
}
