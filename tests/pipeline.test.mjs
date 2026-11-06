import assert from 'node:assert/strict'
import test from 'node:test'
import { SerialLines } from '../src/serial.ts'
import { channelsOf, csv, defaults, demoFrame, makeSensor, persist, projectValues, restore, seriesPoints, TIME } from '../src/model.ts'

test('serial stream accepts split UTF-8 and CRLF, rejects invalid frames and recovers', () => {
  const frames = []
  let invalid = 0
  const lines = new SerialLines(frame => frames.push(frame), () => invalid++)
  const encoder = new TextEncoder()
  const bytes = encoder.encode('{"mode":"café","flow_lpm":2.1}\r\n\ninvalid\n[1]\nnull\n{"x":{}}\n{"bad":1e999}\n{"p":null,"enabled":false}\n')
  const split = bytes.indexOf(0xc3) + 1
  lines.push(bytes.subarray(0, split))
  assert.equal(frames.length, 0)
  lines.push(bytes.subarray(split))
  lines.push(encoder.encode('a'.repeat(66_000)))
  lines.push(encoder.encode('discarded\n{"flow_lpm":3}\n{"unterminated":7}'))
  assert.deepEqual(frames, [{mode:'café',flow_lpm:2.1},{enabled:false},{flow_lpm:3}])
  assert.equal(invalid, 6)
  new SerialLines(frame => frames.push(frame), () => invalid++).push(encoder.encode('{"flow_lpm":4}\n'))
  assert.equal(frames.at(-1).flow_lpm, 4)
})

test('custom flow, pressure drop and persisted scatter options survive project switching', () => {
  const projects = defaults()
  const [mist,flow] = projects
  const sensor = makeSensor('custom')
  sensor.name = 'Custom flow sensor'
  const channel = sensor.channels[0]
  Object.assign(channel, {name:'Flow',unit:'L/min',field:'flow_lpm'})
  flow.sensors.push(sensor)
  flow.chart = {x:channel.id,ys:['delta-p']}
  const store = new Map()
  const storage = {getItem:key => store.get(key),setItem:(key,value) => store.set(key,value)}
  persist(storage,projects,flow.id)
  assert.equal(restore(storage).selected,flow.id)
  persist(storage,restore(storage).projects,mist.id)
  const saved = restore(storage)
  assert.equal(saved.selected,mist.id)
  const savedFlow = saved.projects.find(p=>p.id===flow.id)
  assert.deepEqual(savedFlow,flow)
  const channels = channelsOf(savedFlow)
  const frame = demoFrame('flow',9)
  const records = [
    {at:1000,values:projectValues(frame,channels)},
    {at:2000,values:projectValues({flow_lpm:6,upstream_kpa:7},channels)},
    {at:3000,values:projectValues({upstream_kpa:7,downstream_kpa:3},channels)},
  ]
  assert.deepEqual(seriesPoints(records,channel.id,'delta-p',1000),[{x:frame.flow_lpm,y:frame.upstream_kpa-frame.downstream_kpa}])
  assert.equal(seriesPoints(records,TIME,'delta-p',1000).length,2)
  assert.deepEqual(seriesPoints(records,channel.id,TIME,1000),[{x:frame.flow_lpm,y:0},{x:6,y:1}])
  assert.equal(projectValues(frame,channels.map(c=>c.id==='upstream-0'?{...c,unit:'psi'}:c))['delta-p'],undefined)
})

test('CSV retains each timestamp and sample, includes calculations and leaves gaps blank', () => {
  const channels = channelsOf(defaults()[1])
  const run = {start:1000,name:'test',notes:'',channels,markers:[],samples:[
    {at:1250,values:projectValues({flow_lpm:0,upstream_kpa:11,downstream_kpa:8},channels)},
    {at:1500,values:projectValues({downstream_kpa:8},channels)},
    {at:1750,values:projectValues({},channels)},
  ]}
  assert.equal(csv(run),[
    'timestamp,elapsed_s,Flow [L/min],Pressure [kPa],Pressure [kPa],ΔP [kPa]',
    '1970-01-01T00:00:01.250Z,0.250,0,11,8,3',
    '1970-01-01T00:00:01.500Z,0.500,,,8,',
    '1970-01-01T00:00:01.750Z,0.750,,,,','',
  ].join('\r\n'))
})
