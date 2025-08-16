import http from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname 相当をESMで再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- サーバー ----
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(200);
  res.end("OK: Use client for UI");
});

// ---- 定数 ----
const MAX_PLAYERS = 3;

// ---- ルーム管理 ----
const rooms = new Map();

function genCode() {
  let c;
  do c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  while (rooms.has(c));
  return c;
}

function firstFreeSeat(room) {
  for (let i = 0; i < MAX_PLAYERS; i++) if (!room.seats[i]) return i;
  return -1;
}

function roomSnapshot(room) {
  return {
    code: room.code,
    seats: room.seats.map((s, i) => (s ? s.nick : null)),
  };
}

function broadcast(room, obj) {
  room.seats.forEach((s) => {
    if (s) s.ws.send(JSON.stringify(obj));
  });
}

// ---- WebSocket ----
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  let joined = null; // {room, seat}

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "create_room") {
        const code = genCode();
        const room = { code, seats: Array(MAX_PLAYERS).fill(null), createdAt: Date.now() };
        rooms.set(code, room);
        ws.send(JSON.stringify({ type: "room_created", code }));
      }

      if (data.type === "join_room") {
        const room = rooms.get(data.roomId);
        if (!room) return ws.send(JSON.stringify({ type: "error", message: "部屋が存在しません" }));
        const seat = firstFreeSeat(room);
        if (seat === -1) return ws.send(JSON.stringify({ type: "error", message: "満席です" }));
        room.seats[seat] = { nick: data.playerName, ws };
        joined = { room, seat };
        ws.send(JSON.stringify({ type: "joined", seatIndex: seat }));
        broadcast(room, { type: "room_state", seats: roomSnapshot(room).seats });
      }

      if (data.type === "ready" && joined) {
        joined.room.seats[joined.seat].ready = true;
        broadcast(joined.room, { type: "update", snapshot: roomSnapshot(joined.room) });
        if (joined.room.seats.every((s) => s && s.ready)) {
          broadcast(joined.room, { type: "start" });
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  ws.on("close", () => {
    if (joined) {
      const { room, seat } = joined;
      room.seats[seat] = null;
      broadcast(room, { type: "room_state", seats: roomSnapshot(room).seats });
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
