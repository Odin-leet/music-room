import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

// In-process messages from FriendsService to the /me gateway, published
// only AFTER the change has committed (same pattern as EventsBus / PlaylistsBus).
export type FriendsBusMessages = {
  // Something changed between these two people (request, accept, decline,
  // cancel, unfriend). Both are told, each with the OTHER person's id.
  'friends.changed': { userIds: [string, string] };
};

@Injectable()
export class FriendsBus {
  private readonly emitter = new EventEmitter();

  publish<K extends keyof FriendsBusMessages>(type: K, payload: FriendsBusMessages[K]) {
    this.emitter.emit(type, payload);
  }

  on<K extends keyof FriendsBusMessages>(type: K, handler: (payload: FriendsBusMessages[K]) => void) {
    this.emitter.on(type, handler);
  }
}
