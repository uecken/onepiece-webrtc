# One Piece Card Battle - Google Spreadsheet WebRTC App

## プロジェクト概要

ワンピースカードバトルのオンライン対戦用WebRTCアプリ（サーバーレス版）。
Google SpreadsheetとApps Scriptを使用してシグナリングを実現。

## 技術スタック

- **フロントエンド**: 純粋なHTML/CSS/JavaScript（ビルドツール不要）
- **バックエンド**: Google Apps Script（Webアプリとしてデプロイ）
- **データ保存**: Google Spreadsheet
- **通信**: WebRTC API（P2Pビデオ通信）

## ファイル構成

```
webrtc_spreadsheet/
├── index.html              # マッチング画面（島選択）
├── battle.html             # 対戦画面（WebRTCビデオ）
├── README.md               # セットアップ手順
├── css/
│   ├── common.css          # 共通スタイル
│   ├── matching.css        # マッチング画面用
│   └── battle.css          # 対戦画面用
├── js/
│   ├── config.js           # GAS URL設定・定数
│   ├── utils.js            # ユーティリティ関数
│   ├── spreadsheet-service.js  # GAS API呼び出し
│   ├── webrtc-service.js   # WebRTC接続管理
│   ├── matching.js         # マッチング画面ロジック
│   └── battle.js           # 対戦画面ロジック
└── gas/
    └── Code.gs             # Google Apps Scriptコード
```

## セットアップ

1. Google Spreadsheetを作成
2. 3つのシート追加: Islands, Signaling, IceCandidates
3. gas/Code.gs をApps Scriptにコピー
4. Webアプリとしてデプロイ
5. js/config.js にGAS URLを設定

詳細は README.md を参照。

## 関連プロジェクト

- **webrtc_front**: Firebase版（リアルタイム同期版）
  - パス: c:\Users\thefu\Documents\webrtc_front
  - URL: https://onepiece-web-a1c05.web.app
