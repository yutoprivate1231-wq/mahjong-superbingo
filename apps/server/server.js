// apps/server/server.js
import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
import crypto from "crypto";

const app = express();

// RenderはPORTを環境変数で注入する（ローカルは3000）
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(cors({ origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN }));
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
app.get("/", (_req, res) => res.status(200).send("OK / Use Static Site for UI"));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// ---- ルーム管理（メモリ） ----
/**
 * room = {
 *   code: "6桁",
 *   seats: [ {id,nick,ws,ready:false}|null, ... x4 ],
 *   createdAt: number
 * }
 */
const rooms = new Map();

function genCode() {
  let c;
  do c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  while (rooms.has(c));
  return c;
}
function firstFreeSeat(room) {
  for (let i = 0; i < 4; i++) if (!room.seats[i]) return i;
  return -1;
}
function roomSnapshot(room) {
  return {
    code: room.code,
    players: room.seats.map((s, i) =>
      s ? { seat: i, nick: s.nick, ready: !!s.ready } : null
    ),
  };
}
function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  room.seats.forEach((s) => {
    if (s && s.ws && s.ws.readyState === 1) s.ws.send(data);
  });
}

wss.on("connection", (ws) => {
  ws.id = crypto.randomUUID();
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  const send = (obj) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  };

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return send({ type: "error", reason: "BAD_JSON" });
    }

    // ---- ルーム作成 ----
    if (msg.type === "create_room") {
      const nick = String(msg.nick || "guest").slice(0, 24);
      const code = genCode();
      const room = { code, seats: [null, null, null, null], createdAt: Date.now() };
      rooms.set(code, room);
      const seat = firstFreeSeat(room);
      room.seats[seat] = { id: ws.id, nick, ws, ready: false };
      ws.roomCode = code;
      ws.seat = seat;
      send({ type: "room_created", code, seat, ...roomSnapshot(room) });
      return;
    }

    // ---- 参加 ----
    if (msg.type === "join_room") {
      const { code } = msg;
      const nick = String(msg.nick || "guest").slice(0, 24);
      const room = rooms.get(code);
      if (!room) return send({ type: "error", reason: "ROOM_NOT_FOUND" });
      const seat = firstFreeSeat(room);
      if (seat === -1) return send({ type: "error", reason: "ROOM_FULL" });
      room.seats[seat] = { id: ws.id, nick, ws, ready: false };
      ws.roomCode = code;
      ws.seat = seat;
      send({ type: "joined", code, seat, ...roomSnapshot(room) });
      broadcast(room, { type: "player_joined", seat, nick, ...roomSnapshot(room) });
      return;
    }

    // ---- Ready ----
    if (msg.type === "ready") {
      const room = rooms.get(ws.roomCode);
      if (!room || ws.seat == null) return;
      if (room.seats[ws.seat]) room.seats[ws.seat].ready = true;
      broadcast(room, { type: "ready", seat: ws.seat, ...roomSnapshot(room) });

      const filled = room.seats.every(Boolean);
      const allReady = room.seats.every((s) => s?.ready);
      if (filled && allReady) {
        broadcast(room, { type: "start", code: room.code, players: roomSnapshot(room).players });
      }
      return;
    }

    // ---- チャット（動作確認用）----
    if (msg.type === "chat") {
      const room = rooms.get(ws.roomCode);
      if (!room || ws.seat == null) return;
      broadcast(room, { type: "chat", seat: ws.seat, text: String(msg.text || ""), ts: Date.now() });
      return;
    }

    if (msg.type === "ping") return send({ type: "pong", ts: Date.now() });

    send({ type: "error", reason: "UNKNOWN_TYPE" });
  });

  ws.on("close", () => {
    const code = ws.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    if (ws.seat != null && room.seats[ws.seat]) {
      const nick = room.seats[ws.seat].nick;
      room.seats[ws.seat] = null;
      broadcast(room, { type: "player_left", seat: ws.seat, nick, ...roomSnapshot(room) });
    }
    // 無人になった部屋は破棄
    if (room.seats.every((s) => !s)) rooms.delete(code);
  });
});

// ヘルスチェックと心拍
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
