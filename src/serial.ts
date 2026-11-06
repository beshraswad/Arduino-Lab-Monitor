import type { Frame } from './model.ts'
const MAX_LINE = 65536
export class SerialLines {
  private pending = ''
  private dropping = false
  private decoder = new TextDecoder()
  constructor(onFrame: (frame: Frame) => void, onInvalid: () => void) {
    this.onFrame = onFrame
    this.onInvalid = onInvalid
  }
  private onFrame: (frame: Frame) => void
  private onInvalid: () => void
  push(bytes: Uint8Array) {
    const parts = this.decoder.decode(bytes, {stream:true}).split('\n')
    parts.forEach((part, i) => {
      const complete = i < parts.length-1
      if (!this.dropping) {
        if (this.pending.length + part.length > MAX_LINE) {
          this.onInvalid()
          this.pending = ''
          this.dropping = true
        } else this.pending += part
      }
      if (!complete) return
      if (!this.dropping && this.pending.trim()) {
        let data: unknown
        try { data = JSON.parse(this.pending) } catch { this.onInvalid() }
        if (data !== undefined) {
          if (data === null || typeof data !== 'object' || Array.isArray(data)) this.onInvalid()
          else {
            const entries = Object.entries(data)
            const primitive = entries.every(([,value]) => value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
            if (!primitive) this.onInvalid()
            else this.onFrame(Object.fromEntries(entries.filter(([,value]) => value !== null)))
          }
        }
      }
      this.pending = ''
      this.dropping = false
    })
  }
}
