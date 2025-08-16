// apps/client/src/main.jsx
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws";

function App() {
  const [nick, setNick] = useState("yuto");
  const [code, setCode] = useState("");
  const [mySeat, setMySeat] = useState(null);
  const [players, setPlayers] = useState([null, null, null, null]);
  const [log, setLog] = useState([]);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [ready, setReady] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [chatText, setChatText] = useState("");

  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      setLog((prev) => [...prev, m]);

      if (m.type === "room_created" || m.type === "joined") {
        setCode(m.code);
        setMySeat(m.seat);
        setPlayers(m.players);
        setJoined(true);
      }
      if (m.type === "player_joined" || m.type === "player_left" || m.type === "ready") {
        setPlayers(m.players);
      }
      if (m.type === "start") {
        setLog((prev) => [...prev, { type: "system", text: "対戦開始" }]);
      }
      if (m.type === "chat") {
        // そのままlogに流しているので追加処理不要
      }
    };
    return () => ws.close();
  }, []);

  const send = (obj) => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify(obj));

  const createRoom = () => send({ type: "create_room", nick });
  const joinRoom = () => send({ type: "join_room", code: joinCodeInput.trim(), nick });
  const readyUp = () => { send({ type: "ready" }); setReady(true); };
  const sendChat = () => { if (chatText.trim()) send({ type: "chat", text: chatText.trim() }); setChatText(""); };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1>SuperBingo MVP: ルーム同期テスト</h1>
      <p>接続状態: {connected ? "接続中" : "未接続"}</p>

      {!joined ? (
        <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <div>
            ニックネーム：{" "}
            <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={createRoom} disabled={!connected}>部屋を作る</button>
            <span>または</span>
            <input placeholder="招待コード6桁" value={joinCodeInput} onChange={(e)=>setJoinCodeInput(e.target.value)} style={{ width: 140 }} />
            <button onClick={joinRoom} disabled={!connected || !joinCodeInput.trim()}>部屋に入る</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
            <div>招待コード：<b style={{ fontSize: 20 }}>{code}</b>（この6桁を友人に共有）</div>
            <div>あなたの席：東西南北のうち <b>{mySeat}</b>（0〜3）</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 8 }}>
              {players.map((p, i) => (
                <div key={i} style={{ border: "1px solid #eee", padding: 8, borderRadius: 6, background: p ? "#f9f9ff" : "#fafafa" }}>
                  <div>Seat {i}</div>
                  <div>{p ? p.nick : "（空席）"}</div>
                  <div style={{ color: p?.ready ? "green" : "#999" }}>{p?.ready ? "準備OK" : ""}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={readyUp} disabled={ready}>準備完了</button>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <div>チャット（動作確認用）：</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={chatText} onChange={(e)=>setChatText(e.target.value)} style={{ flex: 1 }} />
              <button onClick={sendChat}>送信</button>
            </div>
          </div>
        </>
      )}

      <h3 style={{ marginTop: 16 }}>受信ログ</h3>
      <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#ddd", padding: 12, borderRadius: 8, maxHeight: 300, overflow: "auto" }}>
        {log.map((m, i) => JSON.stringify(m)).join("\n")}
      </pre>

      <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        接続先WS: <code>{WS_URL}</code>
      </p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
