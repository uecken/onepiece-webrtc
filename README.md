# One Piece Card Battle - WebRTC Online Battle

ワンピースカードバトルのオンライン対戦アプリ。スマホのカメラでカードフィールドを映し、リアルタイムで対戦できます。

## Demo

https://onepiece-web-a1c05.web.app

## Features

- 複数の「島」から対戦相手を探す
- WebRTCによるP2Pビデオ通信（低遅延）
- スマホ最適化UI

## Tech Stack

- HTML/CSS/JavaScript（ビルドツール不要）
- Firebase Firestore（シグナリング）
- Firebase Hosting
- WebRTC API

## Setup

```bash
# 1. Firebase CLIインストール
npm install -g firebase-tools

# 2. ログイン
firebase login

# 3. デプロイ
firebase deploy
```

## Project Structure

```
├── index.html          # マッチング画面
├── battle.html         # 対戦画面
├── js/
│   ├── config.js       # Firebase設定
│   ├── firebase-service.js
│   ├── webrtc-service.js
│   ├── matching.js
│   └── battle.js
└── css/
```

## Security

- Firestoreルールで書き込みを制限（`firestore.rules`）
- XSS対策（textContent使用）
- 本番運用時はFirebase Authentication推奨

## License

MIT
