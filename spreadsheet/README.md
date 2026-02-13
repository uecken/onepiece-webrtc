# One Piece Card Battle - Google Spreadsheet版

Google Spreadsheetを使ったサーバーレスWebRTCアプリです。
Firebaseの代わりにGoogle Apps Scriptでシグナリングを管理します。

## セットアップ手順

### 1. Google Spreadsheetの作成

1. [Google Spreadsheet](https://sheets.google.com)で新しいスプレッドシートを作成
2. シート名を「Islands」に変更
3. 以下のヘッダーを1行目に入力：
   ```
   A1: islandId
   B1: name
   C1: status
   D1: waitingUser
   E1: users
   F1: currentBattleId
   G1: updatedAt
   ```
4. 2行目以降に島データを入力：
   ```
   A2: east-blue    B2: East Blue Island    C2: empty
   A3: grand-line   B3: Grand Line Island   C3: empty
   A4: new-world    B4: New World Island    C4: empty
   A5: wano         B5: Wano Country        C5: empty
   A6: skypiea      B6: Skypiea Island      C6: empty
   ```

### 2. 「Battles」シートの追加

1. 新しいシートを追加し、名前を「Battles」に変更
2. 以下のヘッダーを1行目に入力：
   ```
   A1: battleId
   B1: islandId
   C1: creatorId
   D1: joinerId
   E1: status
   F1: createdAt
   G1: endedAt
   ```

### 3. 「Signaling」シートの追加

1. 新しいシートを追加し、名前を「Signaling」に変更
2. 以下のヘッダーを1行目に入力：
   ```
   A1: battleId
   B1: type
   C1: sdp
   D1: fromUserId
   E1: createdAt
   ```

### 4. 「IceCandidates」シートの追加

1. 新しいシートを追加し、名前を「IceCandidates」に変更
2. 以下のヘッダーを1行目に入力：
   ```
   A1: battleId
   B1: candidate
   C1: sdpMid
   D1: sdpMLineIndex
   E1: fromUserId
   F1: createdAt
   ```

### 5. Google Apps Scriptの設定

1. スプレッドシートで「拡張機能」→「Apps Script」を開く
2. `gas/Code.gs`の内容をコピーしてエディタに貼り付け
3. **Ctrl + S** で保存
4. 「デプロイ」→「新しいデプロイ」を選択
5. 「種類」で「ウェブアプリ」を選択
6. 設定：
   - 説明: One Piece Card Battle API
   - 実行するユーザー: 自分
   - アクセスできるユーザー: 全員
7. 「デプロイ」をクリック
8. **ウェブアプリのURL**をコピー

#### シートの自動作成（推奨）

手動でシートを作成する代わりに、GASの `setupInitialData()` 関数を使うと自動で全シートが作成されます：

1. Apps Scriptエディタで関数選択ドロップダウンから `setupInitialData` を選択
2. 「実行」ボタンをクリック
3. 初回は「承認」を求められるので許可
4. スプレッドシートに4つのシート（Islands, Battles, Signaling, IceCandidates）が自動作成される

### 6. フロントエンドの設定

1. `js/config.js`を開く
2. `GAS_WEB_APP_URL`にコピーしたURLを設定

```javascript
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/XXXXXX/exec';
```

### 7. アプリの起動

1. HTTPSサーバーでindex.htmlを開く（localhostでも可）
2. 例: `npx serve .` または VS Code Live Server拡張機能

## ファイル構成

```
webrtc_spreadsheet/
├── index.html              # マッチング画面
├── battle.html             # 対戦画面
├── css/
│   ├── common.css          # 共通スタイル
│   ├── matching.css        # マッチング画面用
│   └── battle.css          # 対戦画面用
├── js/
│   ├── config.js           # 設定（GAS URL等）
│   ├── utils.js            # ユーティリティ関数
│   ├── spreadsheet-service.js  # GAS API呼び出し
│   ├── webrtc-service.js   # WebRTC管理
│   ├── matching.js         # マッチング画面ロジック
│   └── battle.js           # 対戦画面ロジック
├── gas/
│   └── Code.gs             # Google Apps Scriptコード
└── README.md               # このファイル
```

## Google Apps Script の更新方法

Code.gsを修正した後は、**必ず新しいデプロイを作成**してください。

### 更新手順

1. **Apps Scriptエディタを開く**
   - スプレッドシート → 「拡張機能」→「Apps Script」

2. **コードを更新**
   - `gas/Code.gs`の最新内容をエディタにコピー＆ペースト
   - **Ctrl + S** で保存

3. **新しいデプロイを作成（重要！）**
   - 「デプロイ」→「新しいデプロイ」を選択
   - ⚠️ 「デプロイを管理」から既存を編集しても**古いコードが実行されます**
   - 「ウェブアプリ」を選択
   - 設定:
     - 次のユーザーとして実行: **自分**
     - アクセスできるユーザー: **全員**
   - 「デプロイ」をクリック

4. **新しいURLをコピー**
   - 新しいデプロイURL（`https://script.google.com/macros/s/XXXXX/exec`）をコピー

5. **config.jsを更新**
   ```javascript
   const GAS_WEB_APP_URL = '新しいデプロイURL';
   ```

### よくあるエラー

| エラー | 原因 | 解決方法 |
|--------|------|----------|
| `Cannot read properties of null (reading 'appendRow')` | シートが存在しない | `setupInitialData()` を実行 |
| `Cannot read properties of null (reading 'getDataRange')` | シートが存在しない | `setupInitialData()` を実行 |
| `Unknown action` | GASが古いバージョン | 新しいデプロイを作成 |

## 注意事項

- Google Apps Scriptには実行時間制限（6分/回）があります
- ポーリング間隔は5秒に設定されています（APIリクエスト制限対策）
- 本番運用時はCORS設定を確認してください
- **デプロイを更新するたびにURLが変わる**ので、config.jsの更新を忘れずに

## トラブルシューティング

### マイク/音声が聞こえない

1. **ブラウザのコンソールを確認**
   - `Audio tracks: 1` → マイクは正常に取得
   - `Audio tracks: 0` → マイクの権限を確認
   - `Remote audio tracks: 1` → 相手の音声を受信中

2. **マイクの権限を確認**
   - ブラウザのアドレスバー横のカメラ/マイクアイコンをクリック
   - マイクが「許可」になっているか確認

3. **モバイルの場合**
   - iOS Safari: 設定 → Safari → マイク → 許可
   - Android Chrome: サイト設定 → マイク → 許可

### 接続できない

1. **STUN/TURNサーバーの確認**
   - 企業ネットワークではWebRTCがブロックされている場合があります
   - 別のネットワーク（モバイル回線等）で試してください

2. **コンソールでICE候補を確認**
   - `ICE candidate generated` が表示されているか確認
   - 表示されない場合はネットワーク問題の可能性

## Firebase版との違い

| 項目 | Firebase版 | Spreadsheet版 |
|------|-----------|---------------|
| リアルタイム更新 | onSnapshotで即時 | ポーリング（5秒間隔） |
| セットアップ | Firebaseプロジェクト | Spreadsheet + GAS |
| スケーラビリティ | 高い | 低い（GAS制限） |
| 状態確認 | Firebase Console | スプレッドシート直接 |
| 費用 | 無料〜従量課金 | 完全無料 |
