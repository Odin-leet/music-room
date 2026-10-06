import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

// In-process messages from the services to the realtime gateway, published
// only AFTER the database change has committed. It keeps the services free
// of any WebSocket code, and avoids a circular dependency (the gateway needs
// EventsService for access checks).
export type BusMessages = {
  // A track was suggested, voted, un-voted, or the playing track changed.
  'queue.changed': { eventId: string };
  // Name / visibility / license / geo changed, or someone was invited:
  // clients refetch details; sockets that lost access get removed.
  'event.changed': { eventId: string };
  'event.deleted': { eventId: string };
};

@Injectable()
export class EventsBus {
  private readonly emitter = new EventEmitter();

  publish<K extends keyof BusMessages>(type: K, payload: BusMessages[K]) {
    this.emitter.emit(type, payload);
  }

  on<K extends keyof BusMessages>(type: K, handler: (payload: BusMessages[K]) => void) {
    this.emitter.on(type, handler);
  }
}
