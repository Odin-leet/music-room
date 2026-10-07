import { ConsoleLogger, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Socket } from 'socket.io';
import { clientFromHandshake, clientFromHeaders } from './client-info';

// One structured JSON line per action (brief V.6). Its own logger so the
// rest of the API's output stays human-readable.
// Never logged: request bodies, query strings, tokens, passwords.
export const actionLogger = new ConsoleLogger('Action', { json: true });

// Every HTTP request, logged when the response is finished — so it covers
// everything, including requests refused by a guard (401) or the rate
// limiter (429), which an interceptor would never see.
@Injectable()
export class ActionLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      // The route pattern (/playlists/:id/tracks), not the raw URL: ids
      // would make every line unique, and the query string can hold codes.
      const route = (req.route as { path?: string } | undefined)?.path;
      const path = route ? `${req.baseUrl}${route}` : '(no route)';
      actionLogger.log({
        action: `${req.method} ${path}`,
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        userId: (req.user as { userId?: string } | undefined)?.userId ?? null,
        ip: req.ip,
        client: clientFromHeaders(req.headers),
      });
    });
    next();
  }
}

// Socket actions (connect / join): same fields, from the handshake.
export function logSocketAction(socket: Socket, action: string, extra: Record<string, unknown> = {}) {
  actionLogger.log({
    action: `socket ${socket.nsp.name} ${action}`,
    userId: (socket.data as { userId?: string }).userId ?? null,
    ip: socket.handshake.address,
    client: clientFromHandshake(socket.handshake.auth),
    ...extra,
  });
}
