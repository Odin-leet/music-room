import type { OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type {
  JoinAck,
  PlaylistClientToServerEvents,
  PlaylistServerToClientEvents,
} from '@music-room/shared';
import type { Namespace, Socket } from 'socket.io';
import { socketAuth } from '../auth/socket-auth';
import { PlaylistsBus } from './playlists-bus';
import { PlaylistsService } from './playlists.service';

type SocketData = { userId: string };
type PlaylistSocket = Socket<PlaylistClientToServerEvents, PlaylistServerToClientEvents, object, SocketData>;
type PlaylistNamespace = Namespace<PlaylistClientToServerEvents, PlaylistServerToClientEvents, object, SocketData>;

const room = (playlistId: string) => `playlist:${playlistId}`;

// Realtime layer for the Playlist Editor: Socket.IO namespace /playlists.
// Unlike Track Vote (which resends the whole ranked queue), it sends small
// change messages: a fractional position is absolute, so "track X is now at
// position P" can be applied on its own, in any order, and stays correct.
// - Connecting requires a valid access token (handshake `auth.token`).
// - `playlist:join` = the same canView check as GET /playlists/:id.
// - The server only sends; every change itself goes through REST.
// Reference for clients: docs/realtime.md
@WebSocketGateway({ namespace: '/playlists', cors: { origin: true } })
export class PlaylistsGateway implements OnGatewayInit, OnModuleInit {
  @WebSocketServer()
  private readonly server: PlaylistNamespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly playlists: PlaylistsService,
    private readonly bus: PlaylistsBus,
  ) {}

  afterInit(server: PlaylistNamespace) {
    server.use(socketAuth(this.jwt));
  }

  onModuleInit() {
    const to = (playlistId: string) => this.server.to(room(playlistId));
    this.bus.on('track.added', (p) => to(p.playlistId).emit('track:added', p));
    this.bus.on('track.moved', (p) => to(p.playlistId).emit('track:moved', p));
    this.bus.on('track.removed', (p) => to(p.playlistId).emit('track:removed', p));
    this.bus.on('playlist.changed', ({ playlistId }) => void this.onPlaylistChanged(playlistId));
    this.bus.on('playlist.deleted', ({ playlistId }) => this.onPlaylistDeleted(playlistId));
  }

  @SubscribeMessage('playlist:join')
  async join(@ConnectedSocket() socket: PlaylistSocket, @MessageBody() body: { playlistId?: unknown }): Promise<JoinAck> {
    const playlistId = typeof body?.playlistId === 'string' ? body.playlistId : '';
    if (!(await this.playlists.canUserView(playlistId, socket.data.userId))) {
      return { ok: false, error: 'Playlist not found' };
    }
    await socket.join(room(playlistId));
    return { ok: true };
  }

  @SubscribeMessage('playlist:leave')
  async leave(@ConnectedSocket() socket: PlaylistSocket, @MessageBody() body: { playlistId?: unknown }) {
    if (typeof body?.playlistId === 'string') await socket.leave(room(body.playlistId));
    return { ok: true as const };
  }

  // Visibility / membership may have changed: remove sockets that can't
  // see the playlist any more, tell the rest to refetch the details.
  private async onPlaylistChanged(playlistId: string) {
    const sockets = await this.server.in(room(playlistId)).fetchSockets();
    for (const s of sockets) {
      if (!(await this.playlists.canUserView(playlistId, s.data.userId))) {
        s.leave(room(playlistId));
        s.emit('playlist:access-lost', { playlistId });
      }
    }
    this.server.to(room(playlistId)).emit('playlist:updated', { playlistId });
  }

  private onPlaylistDeleted(playlistId: string) {
    this.server.to(room(playlistId)).emit('playlist:deleted', { playlistId });
    this.server.in(room(playlistId)).socketsLeave(room(playlistId));
  }
}
