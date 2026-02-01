import { Server } from 'socket.io'
import { EventEmitter } from 'events'
import http from 'http'

export type TelemetryPayload = {
  ts?: number // unix ms
  reverse?: boolean
  lights?: boolean
  speedKph?: number
  rpm?: number
  steeringDeg?: number
  // raw CAN ??
  can?: { id: number; data: number[]; bus?: number }
  // anything else:
  [key: string]: unknown
}

export enum TelemetryEvents {
  Connection = 'connection',

  // external -> main
  Push = 'telemetry:push',

  // main -> clients
  Update = 'telemetry:update',
  Reverse = 'telemetry:reverse',
  Lights = 'telemetry:lights'
}

export class TelemetrySocket extends EventEmitter {
  io: Server | null = null
  httpServer: http.Server | null = null

  constructor(private port = 4000) {
    super()
    this.startServer()
  }

  private setupListeners() {
    this.io?.on(TelemetryEvents.Connection, (socket) => {
      socket.on(TelemetryEvents.Push, (payload: TelemetryPayload) => {
        this.emit(TelemetryEvents.Push, payload)
      })
    })
  }

  private startServer() {
    this.httpServer = http.createServer()
    this.io = new Server(this.httpServer, { cors: { origin: '*' } })
    this.setupListeners()
    this.httpServer.listen(this.port, () => {
      console.log(`[TelemetrySocket] Server listening on port ${this.port}`)
    })
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.io) this.io.close(() => console.log('[TelemetrySocket] IO closed'))
      if (this.httpServer) {
        this.httpServer.close(() => {
          console.log('[TelemetrySocket] HTTP server closed')
          this.io = null
          this.httpServer = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  async connect(): Promise<void> {
    await new Promise((r) => setTimeout(r, 200))
    this.startServer()
  }

  // main -> all clients
  publishTelemetry(payload: TelemetryPayload) {
    const msg = { ts: Date.now(), ...payload }
    this.io?.emit(TelemetryEvents.Update, msg)
  }

  publishReverse(reverse: boolean) {
    this.io?.emit(TelemetryEvents.Reverse, reverse)
  }

  publishLights(lights: boolean) {
    this.io?.emit(TelemetryEvents.Lights, lights)
  }
}
