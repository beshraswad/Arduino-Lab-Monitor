import { useEffect, useRef, useState } from 'react'
import type { Frame } from './model'
import { SerialLines } from './serial'

type Session = { port: SerialPort; reader?: ReadableStreamDefaultReader<Uint8Array>; stop: boolean }
export function useUsb(onFrame: (frame: Frame)=>void, onOpen: ()=>void) {
  const session = useRef<Session | null>(null)
  const busy = useRef(false)
  const receive = useRef(onFrame)
  receive.current = onFrame
  const [status,setStatus] = useState<'disconnected'|'connecting'|'connected'|'closing'>('disconnected')
  const [error,setError] = useState('')
  const [invalid,setInvalid] = useState(0)
  const supported = Boolean(navigator.serial)
  function stop(current: Session) {
    current.stop = true
    void current.reader?.cancel().catch(()=>{})
  }
  useEffect(()=>{
    const unplug = (event: Event) => {
      const current = session.current
      if (current && (event.target===current.port || (event as Event & {port?:SerialPort}).port===current.port)) {
        setStatus('closing')
        setError('USB device unplugged.')
        stop(current)
      }
    }
    navigator.serial?.addEventListener('disconnect',unplug)
    return ()=>{
      navigator.serial?.removeEventListener('disconnect',unplug)
      if (session.current) stop(session.current)
    }
  },[])
  async function connect(baudRate: number) {
    if (!supported || busy.current) return
    busy.current = true
    setStatus('connecting')
    setError('')
    let current: Session | undefined
    try {
      const port = await navigator.serial.requestPort()
      await port.open({baudRate})
      current = {port,stop:false}
      session.current = current
      setInvalid(0)
      onOpen()
      setStatus('connected')
      while (!current.stop && port.readable) {
        const lines = new SerialLines(frame=>receive.current(frame),()=>setInvalid(n=>n+1))
        const reader = port.readable.getReader()
        current.reader = reader
        try {
          while (!current.stop) {
            const {value,done} = await reader.read()
            if (done) { current.stop = true; break }
            if (value && !current.stop) lines.push(value)
          }
        } catch (e) {
          if (!current.stop && port.readable) setInvalid(n=>n+1)
          else if (!current.stop) throw e
        } finally {
          current.reader = undefined
          reader.releaseLock()
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name==='NotFoundError')) setError(e instanceof Error ? e.message : 'Could not open the serial port.')
    } finally {
      if (current) {
        try { await current.port.close() } catch { /* An unplugged port may already be closed. */ }
      }
      session.current = null
      busy.current = false
      setStatus('disconnected')
    }
  }
  function disconnect() {
    if (!session.current) return
    setStatus('closing')
    stop(session.current)
  }
  return {status,error,invalid,supported,connect,disconnect}
}
