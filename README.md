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
├── css/
├── spreadsheet/        # Google Spreadsheet版（別実装）
│   ├── index.html
│   ├── battle.html
│   ├── js/
│   │   └── spreadsheet-service.js
│   └── gas/            # Google Apps Script
└── manual-sdp/         # 手動SDP交換版（サーバー不要）
    └── index.html      # 単一ファイルで完結
```

## Alternative Implementations

### Spreadsheet Version
`spreadsheet/` フォルダにはGoogle Spreadsheet + Google Apps Scriptを使用した別実装があります。Firebaseを使わずに動作させたい場合に利用できます。詳細は `spreadsheet/README.md` を参照してください。

### Manual SDP Exchange Version
`manual-sdp/` フォルダには完全サーバーレスの手動SDP交換版があります。SDPテキストをLINE等で手動コピペして接続します。サーバー・BaaS不要で動作します。

## 接続方法

### 接続URL一覧

| 実装 | URL | 備考 |
|------|-----|------|
| **Firebase版** | https://onepiece-web-a1c05.web.app | 本番環境（推奨） |
| **Spreadsheet版** | https://onepiece-web-a1c05.web.app/spreadsheet/ | GAS設定が必要 |
| **手動SDP版** | https://onepiece-web-a1c05.web.app/manual-sdp/ | サーバー不要 |

### Firebase版（推奨）

最も簡単に利用できるメイン実装です。

1. https://onepiece-web-a1c05.web.app にアクセス
2. 任意の「島」を選択して「待機」をタップ
3. 対戦相手に同じURLを共有
4. 相手が同じ島を選択すると自動でマッチング
5. カメラ・マイクを許可して対戦開始

### Spreadsheet版

Google Apps Script + Spreadsheetを使用したサーバーレス実装です。

**初期設定:**
1. `spreadsheet/gas/Code.gs` を Google Apps Script にコピー
2. 新しいスプレッドシートを作成し、Apps Scriptとして追加
3. ウェブアプリとしてデプロイ（アクセス権: 全員）
4. デプロイURLを `spreadsheet/js/config.js` の `GAS_WEB_APP_URL` に設定

**接続手順:**
1. `spreadsheet/index.html` をHTTPS環境で開く（localhost可）
2. 島を選択して待機
3. 相手も同じ島に入室
4. 自動でWebRTC接続開始

### Manual-SDP版

完全サーバーレス。LINE等でSDPテキストを手動交換します。

**User A（オファー側）:**
1. `manual-sdp/index.html` を開く
2. 「カメラを許可」をタップ
3. 「Offerを作成」をタップ
4. 表示されたテキストをコピーしてLINE等で相手に送信

**User B（アンサー側）:**
1. `manual-sdp/index.html` を開く
2. 「カメラを許可」をタップ
3. 受け取ったOfferテキストを貼り付け
4. 「Answerを作成」をタップ
5. 表示されたテキストをコピーしてUser Aに返信

**User A（接続完了）:**
1. 受け取ったAnswerテキストを貼り付け
2. 「接続」をタップ
3. P2P接続が確立

## Security

- Firestoreルールで書き込みを制限（`firestore.rules`）
- XSS対策（textContent使用）
- 本番運用時はFirebase Authentication推奨

## License

MIT
