import { Logger, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { ClientToServerEvents, JoinAck, ServerToClientEvents } from '@music-room/shared';
import type { Namespace, Socket } from 'socket.io';
import { socketAuth } from '../auth/socket-auth';
import { EventsBus } from './events-bus';
import { EventsService } from './events.service';
import { QueueService } from './queue.service';

type SocketData = { userId: string };
type EventsSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type EventsNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

// Votes that land within this window are sent as one queue update, so a
// burst (10 phones voting in the same second) costs 1–2 broadcasts, not 10.
const QUEUE_BROADCAST_DELAY_MS = 100;

const room = (eventId: string) => `event:${eventId}`;

// Realtime layer for Track Vote: Socket.IO namespace /events.
// - Connecting requires a valid access token (handshake `auth.token`).
// - `event:join` puts the socket in the event's room, after the same
//   canView check as the REST API (a private event's room is members-only).
// - The server only sends; every change itself goes through REST.
// Reference for clients: docs/realtime.md
@WebSocketGateway({ namespace: '/events', cors: { origin: true } })
export class EventsGateway implements OnGatewayInit, OnModuleInit {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly pendingQueue = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  private readonly server: EventsNamespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly events: EventsService,
    private readonly queue: QueueService,
    private readonly bus: EventsBus,
  ) {}

  // Authentication happens here, before the connection is accepted:
  // no/invalid/expired token -> the client gets `connect_error: unauthorized`.
  afterInit(server: EventsNamespace) {
    server.use(socketAuth(this.jwt));
  }

  onModuleInit() {
    this.bus.on('queue.changed', ({ eventId }) => this.scheduleQueueBroadcast(eventId));
    this.bus.on('event.changed', ({ eventId }) => void this.onEventChanged(eventId));
    this.bus.on('event.deleted', ({ eventId }) => this.onEventDeleted(eventId));
  }

  @SubscribeMessage('event:join')
  async join(@ConnectedSocket() socket: EventsSocket, @MessageBody() body: { eventId?: unknown }): Promise<JoinAck> {
    const eventId = typeof body?.eventId === 'string' ? body.eventId : '';
    // Same rule (and same "not found" answer) as GET /events/:id.
    if (!(await this.events.canUserView(eventId, socket.data.userId))) {
      return { ok: false, error: 'Event not found' };
    }
    await socket.join(room(eventId));
    return { ok: true };
  }

  @SubscribeMessage('event:leave')
  async leave(@ConnectedSocket() socket: EventsSocket, @MessageBody() body: { eventId?: unknown }) {
    if (typeof body?.eventId === 'string') await socket.leave(room(body.eventId));
    return { ok: true as const };
  }

  // ---------- reacting to committed changes ----------

  private scheduleQueueBroadcast(eventId: string) {
    if (this.pendingQueue.has(eventId)) return; // already scheduled: it'll include this change
    this.pendingQueue.set(
      eventId,
      setTimeout(() => {
        this.pendingQueue.delete(eventId);
        // Read the queue *after* the delay, so it reflects every change in the window.
        this.queue
          .broadcastView(eventId)
          .then((view) => this.server.to(room(eventId)).emit('queue:updated', view))
          .catch((err: unknown) => this.logger.error(`queue broadcast failed for ${eventId}`, err));
      }, QUEUE_BROADCAST_DELAY_MS),
    );
  }

  // Visibility / license / membership may have changed: re-check everyone
  // in the room, remove those who can't see the event any more, tell the rest.
  private async onEventChanged(eventId: string) {
    const sockets = await this.server.in(room(eventId)).fetchSockets();
    for (const s of sockets) {
      if (!(await this.events.canUserView(eventId, s.data.userId))) {
        s.leave(room(eventId));
        s.emit('event:access-lost', { eventId });
      }
    }
    this.server.to(room(eventId)).emit('event:updated', { eventId });
  }

  private onEventDeleted(eventId: string) {
    this.server.to(room(eventId)).emit('event:deleted', { eventId });
    this.server.in(room(eventId)).socketsLeave(room(eventId));
  }
}
