import type { OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection, type OnGatewayInit } from '@nestjs/websockets';
import type { MeServerToClientEvents } from '@music-room/shared';
import type { Namespace, Socket } from 'socket.io';
import { socketAuth } from '../auth/socket-auth';
import { FriendsBus } from '../friends/friends-bus';

type SocketData = { userId: string };
type MeNamespace = Namespace<Record<string, never>, MeServerToClientEvents, object, SocketData>;

// Each user's own room: every socket of a user (phone, emulator…) is in it.
const room = (userId: string) => `user:${userId.toLowerCase()}`;

// Realtime for things about YOU rather than about an event or a playlist:
// Socket.IO namespace /me. Nothing to join — the room is chosen from the
// token on connection, so you can only ever receive your own messages.
// For now: friend requests and friendships. Reference: docs/realtime.md
@WebSocketGateway({ namespace: '/me', cors: { origin: true } })
export class MeGateway implements OnGatewayInit, OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  private readonly server: MeNamespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly bus: FriendsBus,
  ) {}

  afterInit(server: MeNamespace) {
    server.use(socketAuth(this.jwt));
  }

  async handleConnection(socket: Socket<Record<string, never>, MeServerToClientEvents, object, SocketData>) {
    await socket.join(room(socket.data.userId));
  }

  onModuleInit() {
    this.bus.on('friends.changed', ({ userIds: [a, b] }) => {
      this.server.to(room(a)).emit('friends:changed', { userId: b });
      this.server.to(room(b)).emit('friends:changed', { userId: a });
    });
  }
}
