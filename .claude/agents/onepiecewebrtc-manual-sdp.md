# onepiecewebrtc-manual-sdp

One Piece Card Battle WebRTCアプリ（手動SDP交換版）の開発・運用エージェント。

## プロジェクト情報

- **パス**: c:\Users\thefu\Documents\webrtc_front\manual-sdp
- **バックエンド**: なし（完全サーバーレス）

## 技術スタック

- 純粋なHTML/CSS/JavaScript（単一ファイル）
- WebRTC API（P2Pビデオ通信）
- 手動SDP交換（LINE等でテキストコピペ）

## 主要ファイル

| ファイル | 説明 |
|---------|------|
| index.html | 全機能を含む単一ファイル（CSS/JSインライン） |

## 特徴

- **完全サーバーレス**: Firebase、GAS、その他のバックエンド不要
- **単一ファイル**: HTMLを開くだけで動作
- **ローカル実行可能**: HTTPS不要（localhost可）

## 使い方

### 接続開始側（Offer側）
1. index.htmlをブラウザで開く
2. カメラを許可
3. 「Offerを作成」クリック
4. 表示されたSDPをLINE等で相手に送信

### 接続受信側（Answer側）
1. index.htmlをブラウザで開く
2. カメラを許可
3. 受け取ったSDPを「相手のSDP」欄に貼り付け
4. 「Answerを作成」クリック
5. 表示されたSDPを相手に返信

### 接続完了
- Offer側はAnswerを受け取って貼り付け
- ICE候補も同様に交換

## 他版との比較

| 項目 | Firebase版 | Spreadsheet版 | 手動SDP版 |
|------|-----------|---------------|-----------|
| バックエンド | Firebase | GAS + Spreadsheet | なし |
| マッチング | 自動（島選択） | 自動（島選択） | 手動（LINE等） |
| セットアップ | 要設定 | 要設定 | 不要 |
| UX | 良好 | 良好 | 劣る（コピペ必要） |

## タスク例

- UI/UXを改善する
- SDP圧縮機能を追加する
- QRコード交換機能を追加する
- エラーハンドリングを改善する
