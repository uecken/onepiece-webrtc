# WebRTCシステム比較 — トレカエルバフ対戦プラットフォーム

## 要件

| 要件 | 詳細 |
|------|------|
| **1:1 ビデオ対戦** | 2人のプレイヤーがカメラ映像を送受信しながらカードバトル |
| **対戦動画の録画** | サーバーサイドで録画し、後から再生・ダウンロード可能 |
| **YouTube ライブ配信** | 対戦をリアルタイムでYouTube Liveに配信 (RTMP) |
| **低遅延** | カードバトルなのでサブ秒が理想 (WebRTC: ~200-500ms) |
| **Firebase統合** | 既存のFirebase (Firestore) と連携 |
| **コスト** | 初期は小規模運用、成長に応じてスケール |

---

## 「セルフホスト」とは？ なぜサーバーを経由するべきか？

### P2P (現在) vs SFU (サーバー経由) の違い

```
【現在: P2P方式】
プレイヤーA ←──── 直接接続 ────→ プレイヤーB
                  (録画はブラウザ上)
                  (YouTube配信: 不可)

【目標: SFU方式 (サーバー経由)】
プレイヤーA ───→ ┌──────────────┐ ←─── プレイヤーB
                 │  SFUサーバー    │
                 │  (OpenVidu等)  │
                 │                │
                 │ ・映像の中継     │
                 │ ・録画 (Egress)  │──→ MP4ファイル → Firebase Storage / S3
                 │ ・配信 (RTMP)   │──→ YouTube Live
                 └──────────────┘
```

### SFU (Selective Forwarding Unit) とは

SFUは映像・音声の「中継サーバー」。参加者の映像をそのまま他の参加者に転送する。
トランスコード（再エンコード）しないので低遅延を維持。

### なぜサーバー経由が必要か

| 機能 | P2P (現在) | SFU (サーバー経由) |
|------|-----------|-------------------|
| 1:1ビデオ | ○ | ○ |
| 録画 | △ ブラウザ依存、不安定 | ○ サーバーで安定録画 |
| YouTube配信 | × 不可 | ○ RTMP出力で配信 |
| 接続安定性 | △ NAT/ファイアウォール問題 | ○ サーバー経由で安定 |
| 録画品質 | △ クライアントの性能依存 | ○ サーバーで一定品質 |
| 配信レイアウト | × カスタム不可 | ○ 対戦者名/スコア等重ねられる |

**結論: YouTube配信 & 安定した録画にはSFUサーバーが必須。**

### 「セルフホスト」= 自前のVPSにサーバーソフトをインストールして運用すること

```
クラウドホスト (マネージド)       セルフホスト (自前VPS)
┌─────────────────┐         ┌─────────────────┐
│  LiveKit Cloud    │         │  VPS (自前)       │
│  Cloudflare Calls │         │  ├── OpenVidu     │
│                   │         │  ├── Egress       │
│  ・管理不要        │         │  └── S3 (Minio)   │
│  ・従量課金        │         │                   │
│  ・スケール自動     │         │  ・自分で管理      │
│  ・ベンダー依存     │         │  ・月額固定費      │
│                   │         │  ・完全コントロール  │
└─────────────────┘         └─────────────────┘
```

---

## 候補比較

### 1. OpenVidu (推奨)

**概要:** LiveKitのフォーク(上位互換)。mediasoup統合でLiveKitの2倍のパフォーマンス。

| 項目 | 詳細 |
|------|------|
| **種別** | オープンソース (Apache 2.0) |
| **SFU** | mediasoup (Pro版) / LiveKit互換 |
| **LiveKit互換** | 100%。LiveKit SDKがそのまま使える |
| **録画** | Egress: Room Composite / Track。S3/Minio保存 |
| **YouTube配信** | RTMP出力対応 (YouTube Live, Twitch) |
| **セルフホスト** | AWS/GCP/Azure/DigitalOcean/Oracle対応 |

**料金:**

| エディション | 料金 | 機能 |
|------------|------|------|
| **Community** | **無料** | Single Node。Egress/Ingress/S3(Minio)/モニタリング全て込み |
| **Pro** | $0.0006/コア/分 | Elastic/HA対応。mediasoup(2倍性能)。高度モニタリング |

**Pro版のコスト例 (4コアサーバー):**
- $0.0006 × 4コア × 60分 × 24時間 × 30日 = **~$103/月**
- ※使用時のみ課金。サーバー停止中は無料

**Community版で十分な理由:** 1:1対戦であれば、1台のサーバーで数十組の同時対戦が可能。録画もYouTube配信も全てCommunity版で利用可能。

---

### 2. LiveKit

**概要:** 最大のWebRTCオープンソースプロジェクト (GitHub 19k+ stars)。

| 項目 | 詳細 |
|------|------|
| **種別** | オープンソース (Apache 2.0) |
| **SFU** | 独自実装 (Go言語) |
| **録画** | Egress (GStreamer)。MP4/HLS。S3/Azure/GCP保存 |
| **YouTube配信** | Egress RTMP出力対応 |
| **セルフホスト** | Docker / Kubernetes |
| **クラウド** | LiveKit Cloud あり (マネージド) |

**料金 (LiveKit Cloud):**

| プラン | 月額 | WebRTC | Egress録画 | 同時セッション |
|--------|------|--------|-----------|--------------|
| **Build (無料)** | $0 | 5,000分/月 | 60分/月 | 5 |
| **Ship** | $50~ | 含む | 600分/月 | 20 |
| **Scale** | $500~ | 含む | 8,000分/月 | 600 |

**セルフホストの場合:** 無料 (VPS費用のみ)。ただしEgress/Ingressの設定が複雑。

---

### 3. Cloudflare Calls (Realtime)

| 項目 | 詳細 |
|------|------|
| **種別** | クラウドSFU (マネージドのみ) |
| **録画** | 対応 (RealtimeKit) |
| **YouTube配信** | 直接RTMP未サポート。Cloudflare Stream経由の可能性 |
| **セルフホスト** | **不可** |
| **料金** | 1TB/月 無料、超過 $0.05/GB |

**見送り理由:** RTMP (YouTube配信) の直接サポートが限定的。セルフホスト不可。

---

### 4. Ant Media Server

| 項目 | 詳細 |
|------|------|
| **種別** | オープンソース (Community無料 / Enterprise有料) |
| **録画** | MP4録画対応 |
| **YouTube配信** | RTMP出力対応 |
| **セルフホスト** | 可能 |
| **対応プロトコル** | WebRTC/SRT/RTMP/RTSP/HLS/CMAF |

**見送り理由:** Community版はWebRTC機能が制限。Enterprise版の料金不透明。SDKがLiveKit/OpenViduほど充実していない。配信向けであり、1:1対戦向けではない。

---

## 総合比較

| 要件 | OpenVidu | LiveKit Cloud | LiveKit Self-host | Cloudflare | Ant Media |
|------|----------|--------------|-------------------|------------|-----------|
| 1:1ビデオ | ○ | ○ | ○ | ○ | ○ |
| 録画 (無料) | **○** | △ (60分/月) | ○ | △ | △ |
| YouTube RTMP | **○** | ○ | ○ | × | △ |
| セルフホスト | **○** | - | ○ | × | ○ |
| 管理の容易さ | ○ | **◎** | △ | ◎ | △ |
| コスト (小規模) | **◎ 無料+VPS** | ○ (無料枠) | ◎ (VPSのみ) | ○ | △ |
| パフォーマンス | **◎ (2倍)** | ○ | ○ | ◎ | ○ |
| SDK充実度 | ◎ (LiveKit互換) | **◎** | ◎ | △ | △ |
| Firebase統合 | △ (自前) | △ (自前) | △ (自前) | △ (自前) | △ (自前) |

---

## サーバー (VPS) の選択

### 推奨VPS比較

| プロバイダー | スペック | 月額 | 特徴 |
|-------------|---------|------|------|
| **Hetzner** | 4vCPU / 8GB RAM / 160GB SSD | **~€6 (~$7)** | 最コスパ。欧州DC。日本から遅延あり |
| **Vultr** | 4vCPU / 8GB RAM | ~$48 | 東京DC有り。安定 |
| **DigitalOcean** | 4vCPU / 8GB RAM | ~$48 | シンガポールDC。OpenVidu公式テンプレート有り |
| **AWS EC2** | t3.xlarge (4vCPU/16GB) | ~$120 | 東京リージョン。OpenVidu公式サポート |
| **AWS Lightsail** | 4vCPU / 8GB | ~$40 | 東京リージョン。固定料金で分かりやすい |
| **さくらVPS** | 4コア / 8GB | ~¥3,227 | 日本DC。国内レイテンシ最小 |
| **ConoHa VPS** | 4コア / 8GB | ~¥3,091 | 日本DC。時間課金あり |

### 推奨

**初期 (開発・テスト):** さくらVPS or ConoHa (国内、低遅延、安い)
**本番 (小規模):** DigitalOcean or AWS Lightsail (OpenVidu公式テンプレート)
**本番 (コスト重視):** Hetzner (最安だが日本から遅延あり)

**1:1対戦に必要なスペック目安:**
- 最小: 2vCPU / 4GB RAM (同時2-3対戦)
- 推奨: 4vCPU / 8GB RAM (同時10-20対戦)
- 録画+YouTube配信: 4vCPU / 8GB RAM以上 (Egressがリソースを使う)

---

## 推奨構成

### 第1推奨: OpenVidu Community + 国内VPS

```
Firebase (Firestore + Auth + Hosting)
  ├── バウンティリーグ (Users/Attacks/History)
  ├── マッチング/ルーム管理
  ├── バインダー/デッキ屋 (将来移行)
  └── フロントエンド (Firebase Hosting)
          │
          │ マッチング成立 → OpenVidu Room作成
          ▼
OpenVidu Community (VPS: さくら or DigitalOcean)
  ├── SFU — 1:1 WebRTCビデオ中継
  ├── Egress — 録画 → MP4 → Firebase Storage (or Minio)
  ├── Egress — RTMP → YouTube Live
  └── Minio — S3互換ストレージ (録画ファイル一時保存)
```

**月額コスト見積もり:**
| 項目 | 費用 |
|------|------|
| VPS (4vCPU/8GB) | ~$30-50/月 |
| OpenVidu Community | 無料 |
| Firebase (Spark無料枠) | 無料 |
| ドメイン (SSL) | Let's Encrypt (無料) |
| **合計** | **~$30-50/月** |

### 第2推奨: LiveKit Cloud (サーバー管理不要)

**管理負荷を最小化したい場合:**
- Build (無料) で開始 → 必要に応じてShip ($50/月)
- VPS管理不要
- ただしEgress(録画)の無料枠が60分/月と少ない
- YouTube配信は有料プランが必要

---

## 段階的導入ロードマップ

```
Phase 1: Firebase移行 (GAS → Firestore)     ← 今回
  ・バウンティリーグのGAS → Cloud Functions + Firestore
  ・マッチング管理のFirestore設計
  ・WebRTCは現状のP2P維持

Phase 2: OpenVidu導入 (SFU化)
  ・VPSにOpenVidu Communityデプロイ
  ・P2P → SFU経由に変更
  ・接続安定性向上

Phase 3: 録画機能 (Egress)
  ・サーバーサイド録画 (MP4)
  ・Firebase Storage or S3に自動保存
  ・対戦アーカイブ機能

Phase 4: YouTube Live配信 (RTMP)
  ・対戦をYouTubeにリアルタイム配信
  ・カスタムレイアウト (対戦者名/スコア/タイマー表示)

Phase 5: スケール
  ・OpenVidu Pro (Elastic) で複数サーバー
  ・同時対戦数の拡大
```

---

## 参考リンク

### OpenVidu
- [OpenVidu公式](https://openvidu.io/)
- [OpenVidu GitHub](https://github.com/OpenVidu/openvidu-livekit)
- [OpenVidu料金](https://openvidu.io/pricing/)
- [OpenViduデプロイタイプ](https://openvidu.io/latest/docs/self-hosting/deployment-types/)
- [OpenVidu vs LiveKit比較](https://openvidu.io/3.1.0/docs/comparing-openvidu/)
- [OpenVidu YouTube/Twitch配信](https://openvidu.medium.com/openvidu-2-26-0-broadcast-to-youtube-and-twitch-bd94a0e6cdfa)

### LiveKit
- [LiveKit公式](https://livekit.io/)
- [LiveKit GitHub](https://github.com/livekit/livekit)
- [LiveKit Egress (録画/配信)](https://github.com/livekit/egress)
- [LiveKit Egress ドキュメント](https://docs.livekit.io/home/egress/overview/)
- [LiveKit料金](https://livekit.com/pricing)

### その他
- [Cloudflare Realtime](https://developers.cloudflare.com/realtime/)
- [Ant Media Server](https://antmedia.io/)
- [VPS価格比較](https://getdeploying.com/reference/compute-prices)
