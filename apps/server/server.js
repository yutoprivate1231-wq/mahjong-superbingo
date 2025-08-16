import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

const app = express();

// Render は PORT を注入する。ローカル fallback は 3000。
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN }));
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

// HTTP サーバ共有
const server = http.createServer(app);

// WS サーバ（/ws）
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  ws.send(JSON.stringify({ type: 'hello', msg: 'ws-connected' }));

  ws.on('message', (data) => {
    // エコー + 簡易時刻
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'broadcast', data: data.toString(), ts: Date.now() }));
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
