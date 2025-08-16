import http from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname 相当をESMで再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? path.join(__dirname, "index.html") : path.join(__dirname, req.url);
  const ext = path.extname(filePath);
  const type =
    ext === ".html"
      ? "text/html"
      : ext === ".js"
      ? "application/javascript"
      : "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
    } else {
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    }
  });
});

// ---- 定数 ----
const MAX_PLAYERS = 3;

// ---- ルーム管理 ----
/**
 * room = {
 *   code: "6桁",
 *   seats: [ {id,nick,ws,ready:false}|null, ... x3 ],
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
  for (let i = 0; i < MAX_PLAYERS; i++) if (!room.seats[i]) return i;
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

// ---- WebSocket ----
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let joined = null; // {room, seat}

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "create") {
        const code = genCode();
        const room = { code, seats: Array(MAX_PLAYERS).fill(null), createdAt: Date.now() };
        rooms.set(code, room);
        ws.send(JSON.stringify({ type: "created", code }));
      }

      if (data.type === "join") {
        const room = rooms.get(data.code);
        if (!room) return ws.send(JSON.stringify({ type: "error", message: "部屋が存在しません" }));
        const seat = firstFreeSeat(room);
        if (seat === -1) return ws.send(JSON.stringify({ type: "error", message: "満席です" }));
        room.seats[seat] = { id: Date.now() + Math.random(), nick: data.nick, ws, ready: false };
        joined = { room, seat };
        broadcast(room, { type: "update", snapshot: roomSnapshot(room) });
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
      broadcast(room, { type: "update", snapshot: roomSnapshot(room) });
    }
  });
});

function broadcast(room, obj) {
  room.seats.forEach((s) => {
    if (s) s.ws.send(JSON.stringify(obj));
  });
}

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
