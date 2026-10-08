// A minimal Socket.IO client for k6 (k6 has no Socket.IO library), over
// k6's native WebSocket. Implements just what our app does:
// Engine.IO v4 / Socket.IO v5 over websocket only — connect to a namespace
// with { token }, emit with an acknowledgement, receive events, answer pings.
//
// Frames used ("/events" = the namespace):
//   server "0{…}"                          Engine.IO open
//   client "40/events,{"token":"…"}"       connect to the namespace
//   server "40/events,{"sid":"…"}"         connected (or "44/events,{message}" refused)
//   client "42/events,7["event:join",{…}]" emit, asking for ack #7
//   server "43/events,7[{"ok":true}]"      the ack
//   server "42/events,["queue:updated",{…}]"  an event
//   server "2" / client "3"                ping / pong
import { WebSocket } from 'k6/websockets';
import { clearTimeout, setTimeout } from 'k6/timers';

export function connect(baseUrl, nsp, token, timeoutMs = 10000) {
  const url = `${baseUrl.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`;
  const ws = new WebSocket(url);
  const handlers = {};
  const acks = {};
  let nextAck = 1;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), timeoutMs);
    const client = {
      on: (event, fn) => {
        handlers[event] = fn;
      },
      emitWithAck: (event, payload) =>
        new Promise((res) => {
          const id = nextAck++;
          acks[id] = res;
          ws.send(`42${nsp},${id}${JSON.stringify([event, payload])}`);
        }),
      close: () => ws.close(),
    };

    ws.onerror = (e) => {
      clearTimeout(timer);
      reject(new Error(`socket error: ${e.error}`));
    };
    ws.onmessage = (msg) => {
      const data = String(msg.data);
      if (data === '2') return ws.send('3'); // ping -> pong
      if (data[0] === '0') return ws.send(`40${nsp},${JSON.stringify({ token })}`);
      if (data[0] !== '4') return;
      const type = data[1];
      const rest = data.slice(2 + nsp.length + 1); // after "4X/nsp,"
      if (type === '0') {
        clearTimeout(timer);
        return resolve(client);
      }
      if (type === '4') {
        clearTimeout(timer);
        return reject(new Error(`socket refused: ${rest}`));
      }
      const m = rest.match(/^(\d*)(.*)$/s);
      const id = m[1];
      const body = JSON.parse(m[2]);
      if (type === '3' && acks[id]) {
        acks[id](body[0]);
        delete acks[id];
      } else if (type === '2' && handlers[body[0]]) {
        handlers[body[0]](body[1]);
      }
    };
  });
}
