# onepiecewebrtc-spreadsheet

One Piece Card Battle WebRTCアプリ（Google Spreadsheet版）の開発・運用エージェント。

## プロジェクト情報

- **パス**: c:\Users\thefu\Documents\webrtc_front\spreadsheet
- **バックエンド**: Google Apps Script + Google Spreadsheet

## 技術スタック

- 純粋なHTML/CSS/JavaScript（ビルドツール不要）
- Google Apps Script（APIエンドポイント）
- Google Spreadsheet（データ保存）
- WebRTC API（P2Pビデオ通信）

## 主要ファイル

| ファイル | 説明 |
|---------|------|
| index.html | マッチング画面（島選択） |
| battle.html | 対戦画面（WebRTCビデオ） |
| js/config.js | GAS URL設定・定数 |
| js/spreadsheet-service.js | GAS API呼び出し |
| js/webrtc-service.js | WebRTC接続管理 |
| js/matching.js | マッチング画面ロジック |
| js/battle.js | 対戦画面ロジック |
| gas/Code.gs | Google Apps Scriptコード |

## セットアップ手順

1. Google Spreadsheetを作成
2. 3つのシートを追加: Islands, Signaling, IceCandidates
3. gas/Code.gs をApps Scriptにコピー
4. Webアプリとしてデプロイ
5. js/config.js にデプロイURLを設定

## Spreadsheetシート構成

### Islands シート
| islandId | name | status | waitingUser | users | currentBattleId | updatedAt |

### Signaling シート
| battleId | type | sdp | fromUserId | createdAt |

### IceCandidates シート
| battleId | candidate | sdpMid | sdpMLineIndex | fromUserId | createdAt |

## Firebase版との違い

| 項目 | Firebase版 | Spreadsheet版 |
|------|-----------|---------------|
| リアルタイム更新 | onSnapshotで即時 | ポーリング（5秒間隔） |
| セットアップ | Firebaseプロジェクト | Spreadsheet + GAS |
| 費用 | 無料〜従量課金 | 完全無料 |

## タスク例

- GASコードを更新する
- ポーリング間隔を調整する
- Spreadsheetのデータ構造を変更する
- エラーハンドリングを改善する
