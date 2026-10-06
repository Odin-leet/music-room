import { Injectable } from '@nestjs/common';
import type { PlaylistTrackView } from '@music-room/shared';
import { EventEmitter } from 'events';

// In-process messages from the playlist services to the realtime gateway,
// published only AFTER the database change has committed (same idea as
// EventsBus for Track Vote).
export type PlaylistBusMessages = {
  'track.added': { playlistId: string; track: PlaylistTrackView };
  'track.moved': { playlistId: string; trackId: string; position: string };
  'track.removed': { playlistId: string; trackId: string };
  // Name / visibility / license changed, or someone was invited: clients
  // refetch details; sockets that lost access get removed.
  'playlist.changed': { playlistId: string };
  'playlist.deleted': { playlistId: string };
};

@Injectable()
export class PlaylistsBus {
  private readonly emitter = new EventEmitter();

  publish<K extends keyof PlaylistBusMessages>(type: K, payload: PlaylistBusMessages[K]) {
    this.emitter.emit(type, payload);
  }

  on<K extends keyof PlaylistBusMessages>(type: K, handler: (payload: PlaylistBusMessages[K]) => void) {
    this.emitter.on(type, handler);
  }
}
