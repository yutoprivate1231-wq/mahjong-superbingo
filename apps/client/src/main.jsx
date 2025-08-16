import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// Render 用の環境変数から取得（ローカルは ws://localhost:3000/ws）
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws";

function App() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [seats, setSeats] = useState([null, null, null]);
  const [playerName, setPlayerName] = useState("");
  const [mySeat, setMySeat] = useState(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    setSocket(ws);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "room_state") {
        setSeats(msg.seats);
      }
      if (msg.type === "room_created") {
        alert(`部屋が作成されました: ${msg.code}`);
        setRoomId(msg.code);
      }
      if (msg.type === "joined") {
        setJoined(true);
        setMySeat(msg.seatIndex);
      }
      if (msg.type === "error") {
        alert(msg.message);
      }
    };

    return () => ws.close();
  }, []);

  const createRoom = () => {
    socket?.send(JSON.stringify({ type: "create_room", playerName }));
  };

  const joinRoom = () => {
    socket?.send(JSON.stringify({ type: "join_room", roomId, playerName }));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>三人麻雀オンライン</h1>

      {!joined ? (
        <div>
          <input
            type="text"
            placeholder="プレイヤー名"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <div style={{ marginTop: "10px" }}>
            <button onClick={createRoom}>ルーム作成</button>
          </div>
          <div style={{ marginTop: "10px" }}>
            <input
              type="text"
              placeholder="ルームIDを入力"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button onClick={joinRoom}>ルーム参加</button>
          </div>
        </div>
      ) : (
        <div>
          <h2>ルームに参加しました</h2>
          <p>あなたの座席: {mySeat !== null ? `Seat ${mySeat}` : "未定"}</p>
          <h3>座席状況</h3>
          <ul>
            {seats.map((player, i) => (
              <li key={i}>
                Seat {i}: {player ? player : "空席"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
