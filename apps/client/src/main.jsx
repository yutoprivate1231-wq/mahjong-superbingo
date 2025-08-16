import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [log, setLog] = useState([])
  const wsRef = useRef(null)

  useEffect(() => {
    const url = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data)
        setLog((prev) => [...prev, m])
      } catch { /* noop */}
    }
    return () => ws.close()
  }, [])

  const send = () => {
    wsRef.current?.send(JSON.stringify({ type: 'ping', at: Date.now() }))
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>SuperBingo Starter (Render)</h1>
      <p>サーバの WebSocket に接続してブロードキャストを受け取る最小ページ。</p>
      <button onClick={send}>WSへ送信</button>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, marginTop: 16, maxHeight: 300, overflow: 'auto' }}>
        {JSON.stringify(log, null, 2)}
      </pre>
      <p>環境変数 <code>VITE_WS_URL</code>（例: <code>wss://your-server.onrender.com/ws</code>）を設定すること。</p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
