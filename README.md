# Mahjong SuperBingo Starter (Render 2-service)

このスターターは Render 上で以下の2サービスに分割してデプロイできる最小構成です。

- apps/server: Node.js + ws (WebSocket) サーバ（/healthz あり）
- apps/client: Vite + React クライアント（VITE_WS_URL でサーバURLを渡す）

## ローカル実行（任意）
node >= 20 を想定。

### Server
```
cd apps/server
npm ci
npm start
# -> http://localhost:3000/healthz
```

### Client
```
cd apps/client
cp .env.example .env.local  # VITE_WS_URL を設定（例: ws://localhost:3000）
npm ci
npm run dev
# -> http://localhost:5173
```

## Render デプロイの要点
- Web Service: ルートディレクトリ `apps/server`、Build command: `npm ci`、Start command: `node server.js`、Health Check Path: `/healthz`
- Static Site: ルートディレクトリ `apps/client`、Build command: `npm ci && npm run build`、Publish Directory: `dist`
- 環境変数: 
  - Web Service: `ALLOWED_ORIGIN`（クライアントURL）, `SERVER_SECRET`（任意のランダム文字列）
  - Static Site: `VITE_WS_URL`（wss://<server>.onrender.com など）

**注**: Render ではポート番号は環境変数 `PORT` で注入されるため、サーバ側は `process.env.PORT` を listen すること。
