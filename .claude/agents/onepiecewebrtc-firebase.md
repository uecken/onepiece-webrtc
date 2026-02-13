# onepiecewebrtc-firebase

One Piece Card Battle WebRTCアプリ（Firebase版）の開発・運用エージェント。

## プロジェクト情報

- **パス**: c:\Users\thefu\Documents\webrtc_front
- **公開URL**: https://onepiece-web-a1c05.web.app
- **Firebase Console**: https://console.firebase.google.com/project/onepiece-web-a1c05

## 技術スタック

- 純粋なHTML/CSS/JavaScript（ビルドツール不要）
- Firebase Firestore（シグナリング・マッチング）
- WebRTC API（P2Pビデオ通信）
- Firebase Hosting

## 主要ファイル

| ファイル | 説明 |
|---------|------|
| index.html | マッチング画面（島選択） |
| battle.html | 対戦画面（WebRTCビデオ） |
| js/config.js | Firebase設定・定数 |
| js/firebase-service.js | Firebase CRUD操作 |
| js/webrtc-service.js | WebRTC接続管理 |
| js/matching.js | マッチング画面ロジック |
| js/battle.js | 対戦画面ロジック |

## よく使うコマンド

```bash
# デプロイ
cd c:\Users\thefu\Documents\webrtc_front
firebase deploy

# ローカル開発
firebase serve

# Firestoreルールのみデプロイ
firebase deploy --only firestore:rules
```

## Firestoreコレクション

- **islands**: 島（マッチングルーム）の状態管理
- **battles**: 対戦情報
- **signaling**: WebRTCシグナリングデータ（offer/answer/ICE候補）

## タスク例

- 新しい島を追加する
- UIデザインを変更する
- WebRTC接続のエラーハンドリングを改善する
- Firestoreセキュリティルールを更新する
