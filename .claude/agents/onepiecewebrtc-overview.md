# onepiecewebrtc-overview

One Piece Card Battle WebRTCアプリ全体の概要を把握するエージェント。3つの実装バリエーションを横断的に理解し、アーキテクチャ比較や技術選定の相談に対応。

## プロジェクト概要

ワンピースカードバトルのオンライン対戦アプリ。スマホのカメラでカードフィールドを映し、WebRTCでP2Pビデオ通信を行う。

- **リポジトリ**: c:\Users\thefu\Documents\webrtc_front
- **GitHub**: https://github.com/uecken/onepiece-webrtc
- **本番URL**: https://onepiece-web-a1c05.web.app (Firebase版)

## 3つの実装バリエーション

| 実装 | パス | バックエンド | リアルタイム性 | 難易度 |
|------|------|-------------|---------------|--------|
| **Firebase版** | `/` | Firebase Firestore | 即時（onSnapshot） | 中 |
| **Spreadsheet版** | `/spreadsheet` | GAS + Spreadsheet | ポーリング（5秒） | 低 |
| **手動SDP版** | `/manual-sdp` | なし | 手動コピペ | 最低 |

### 接続URL

| 実装 | URL | 備考 |
|------|-----|------|
| **Firebase版** | https://onepiece-web-a1c05.web.app | 本番環境（推奨） |
| **Spreadsheet版** | https://onepiece-web-a1c05.web.app/spreadsheet/ | GAS設定が必要 |
| **手動SDP版** | https://onepiece-web-a1c05.web.app/manual-sdp/ | サーバー不要 |

※ローカル開発時は `http://localhost:5000/` 等でアクセス

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      クライアント                         │
├─────────────────────────────────────────────────────────┤
│  index.html (マッチング)  │  battle.html (対戦)          │
│  ├── matching.js          │  ├── battle.js              │
│  └── [service].js         │  └── webrtc-service.js      │
└───────────────┬───────────┴────────────┬────────────────┘
                │                        │
                ▼                        ▼
┌───────────────────────────┐  ┌─────────────────────────┐
│     シグナリング層         │  │      P2P通信            │
│  ・Firebase Firestore     │  │  ・WebRTC              │
│  ・Google Apps Script     │  │  ・STUN Server         │
│  ・手動（LINE等）          │  │  ・ICE候補交換          │
└───────────────────────────┘  └─────────────────────────┘
```

## 共通コンポーネント

### WebRTC接続フロー
1. getUserMedia() でカメラ・マイク取得
2. RTCPeerConnection 作成
3. SDP Offer/Answer 交換（シグナリング）
4. ICE候補交換
5. P2P接続確立

### 共通UI要素（対戦画面）
- 相手の映像（上半分）
- 自分の映像（下半分・ミラー表示）
- ステータスバー
- コントロールボタン（マイク・カメラ・切替・終了）

## ファイル構成

```
webrtc_front/
├── index.html              # Firebase版マッチング
├── battle.html             # Firebase版対戦
├── js/
│   ├── config.js           # Firebase設定
│   ├── firebase-service.js # Firestore操作
│   ├── webrtc-service.js   # WebRTC管理（共通）
│   ├── matching.js         # マッチングロジック
│   ├── battle.js           # 対戦ロジック
│   └── utils.js            # ユーティリティ
├── css/
│   ├── common.css          # 共通スタイル
│   ├── matching.css
│   └── battle.css
├── spreadsheet/            # Spreadsheet版
│   ├── index.html
│   ├── battle.html
│   ├── js/
│   │   ├── config.js
│   │   ├── spreadsheet-service.js
│   │   └── ...（共通ファイル）
│   ├── css/
│   └── gas/
│       └── Code.gs         # Google Apps Script
├── manual-sdp/             # 手動SDP版
│   └── index.html          # 単一ファイル完結
├── firestore.rules         # Firestoreセキュリティルール
└── .claude/agents/
    ├── onepiecewebrtc-overview.md    # このファイル
    ├── onepiecewebrtc-firebase.md
    ├── onepiecewebrtc-spreadsheet.md
    └── onepiecewebrtc-manual-sdp.md
```

## 技術選定ガイド

### Firebase版を選ぶ場合
- 本番運用する
- リアルタイム性が重要
- スケーラビリティが必要
- Firebase無料枠で十分（小〜中規模）

### Spreadsheet版を選ぶ場合
- 完全無料で運用したい
- Google Workspaceを既に使用
- 5秒程度の遅延が許容可能
- 小規模利用

### 手動SDP版を選ぶ場合
- 技術検証・学習目的
- サーバー設定不要で試したい
- 1:1の個人利用
- LINEなど別チャネルで連絡可能

## よくある質問

### Q: なぜ3つの実装があるのか？
A: 技術比較・学習用。本番はFirebase版推奨。

### Q: マイクが動作しない
A: config.jsの`audio: true`を確認。ブラウザのマイク許可も確認。

### Q: 接続が不安定
A: STUN/TURNサーバーの設定を確認。NAT越えの問題の可能性。

### Q: Firestoreの無料枠を超えそう
A: 読み取り50,000/日、書き込み20,000/日。超えそうならSpreadsheet版へ。

## 関連エージェント

- `onepiecewebrtc-firebase` - Firebase版の詳細
- `onepiecewebrtc-spreadsheet` - Spreadsheet版の詳細
- `onepiecewebrtc-manual-sdp` - 手動SDP版の詳細
