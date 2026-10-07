import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import { logSocketAction } from '../common/action-log';
import type { JwtPayload } from './jwt.strategy';

// Socket.IO middleware shared by every gateway (/events, /playlists, /me):
// the access token goes in the handshake (`auth: { token }`). Checked before
// the connection is accepted; no / invalid / expired token -> the client gets
// `connect_error: unauthorized` (and refreshes its token, then reconnects).
export function socketAuth(jwt: JwtService) {
  return (socket: Socket, next: (err?: Error) => void) => {
    const token = (socket.handshake.auth as { token?: unknown }).token;
    try {
      if (typeof token !== 'string') throw new Error('no token');
      (socket.data as { userId: string }).userId = jwt.verify<JwtPayload>(token).sub;
      logSocketAction(socket, 'connect');
      next();
    } catch {
      logSocketAction(socket, 'connect refused (unauthorized)');
      next(new Error('unauthorized'));
    }
  };
}
