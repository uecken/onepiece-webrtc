# One Piece Card Battle - Firebase WebRTC App

## プロジェクト概要

ワンピースカードバトルのオンライン対戦用WebRTCアプリ。
スマホのフロントカメラでカードフィールドを映し、リアルタイムで対戦可能。

## 技術スタック

- **フロントエンド**: 純粋なHTML/CSS/JavaScript（ビルドツール不要）
- **バックエンド**: Firebase Firestore（シグナリング・マッチング）
- **通信**: WebRTC API（P2Pビデオ通信）
- **ホスティング**: Firebase Hosting

## Firebase設定

- **プロジェクトID**: onepiece-web-a1c05
- **公開URL**: https://onepiece-web-a1c05.web.app
- **Firestoreロケーション**: asia-northeast1（東京）

## ファイル構成

```
webrtc_front/
├── index.html              # マッチング画面（島選択）
├── battle.html             # 対戦画面（WebRTCビデオ）
├── firebase.json           # Firebase Hosting設定
├── .firebaserc             # Firebaseプロジェクト設定
├── css/
│   ├── common.css          # 共通スタイル
│   ├── matching.css        # マッチング画面用
│   └── battle.css          # 対戦画面用
├── js/
│   ├── config.js           # Firebase設定・定数
│   ├── utils.js            # ユーティリティ関数
│   ├── firebase-service.js # Firebase CRUD操作
│   ├── webrtc-service.js   # WebRTC接続管理
│   ├── matching.js         # マッチング画面ロジック
│   └── battle.js           # 対戦画面ロジック
└── docs/
    └── signaling-comparison.md  # シグナリング方式比較資料
```

## Firestoreデータ構造

### islands コレクション
```
/islands/{islandId}
  - name: string
  - status: "empty" | "waiting" | "in_battle"
  - waitingUser: string | null
  - users: array
  - currentBattleId: string | null
```

### signaling コレクション
```
/signaling/{battleId}
  - offer: { sdp, type, fromUserId }
  - answer: { sdp, type, fromUserId }
  /iceCandidates (subcollection)
    - candidate, sdpMid, sdpMLineIndex, fromUserId
```

## コマンド

### デプロイ
```bash
cd c:\Users\thefu\Documents\webrtc_front
firebase deploy
```

### ローカル開発
```bash
firebase serve
# または
npx serve .
```

### Firestoreルール更新
```bash
firebase deploy --only firestore:rules
```

## 関連プロジェクト

- **webrtc_spreadsheet**: Google Spreadsheet版（同機能のサーバーレス版）
  - パス: c:\Users\thefu\Documents\webrtc_spreadsheet
