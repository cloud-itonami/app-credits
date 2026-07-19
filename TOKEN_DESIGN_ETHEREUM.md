# Ethereumトークン設計（etzhayyim-project-credits / etzhayyim-project-web3-llm）

## 1. 目的

`etzhayyim-project-credits` と `etzhayyim-project-web3-llm` で利用する計算クレジットを、Ethereum上で**購入可能**かつ**DEXでswap可能**にする。

- 対象チェーン: Ethereum Mainnet
- 主要トレジャリー: Safe
  - `eth:0xA00366234D29d4F882088048c0B2fa0dB7302D4E`

---

## 2. 推奨トークン構成

### 2.1 トークン本体: `GCC`（etzhayyim Computing Credit）

- 規格: ERC-20
- シンボル: `GCC`
- 小数: 18
- 主用途:
  - `etzhayyim-project-credits` の計算リソース購入
  - `etzhayyim-project-web3-llm` の推論実行料支払い
  - Browser workerへの報酬配布

### 2.2 決済ペア（初期）

- `GCC/USDC`（主要オンランプ）
- `GCC/WETH`（流動性と価格発見補完）

> ユーザー体験上はUSDC建てを主軸にし、WETHペアは市場価格形成と裁定に利用する。

---

## 3. 発行・償却モデル（運用）

## 3.1 供給方針

- 初期総供給量: 固定上限あり（例: 10億 GCC）
- 配分例:
  - 40%: エコシステム報酬（worker/research/incentive）
  - 25%: トレジャリー（運営・流動性供給）
  - 20%: コミュニティ/グロース
  - 15%: チーム/コア貢献者（ベスティング）

### 3.2 クレジット消費時の処理（確定）

`web3-llm` で推論を実行して `GCC` を消費する際は、**Treasury還流モデルを採用**する。

- 消費された `GCC` は Safe へ送金
- トレジャリー資産として再配分（worker報酬・運営原資・流動性補填）
- Burnは行わない（価値上昇を目的としないため）

> 本設計の目的は投機資産化ではなく、計算資源決済のための運用通貨化。

### 3.3 価格方針（stable coin的運用）

`GCC` は「価格上昇」をKPIにせず、**利用時の決済安定性**を最重視する。

- 目標: 1 GCC ≒ 1 USD 相当の運用レンジ（参考値）
- 手段:
  - `GCC/USDC` プールを主軸に流動性を厚く維持
  - トレジャリーによる供給/回収オペレーションで乖離を抑制
  - アプリ内課金をUSD基準で表示し、必要GCC数量を算出
- 非目的:
  - 値上がり益の訴求
  - デフレ設計（Burnによる希少化）

### 3.4 Mint/Burnポリシー

- **Mint: あり（運営供給用）**
  - 実行主体は Safe 管理下のミンター権限
  - 目的は価格安定と利用需要への追随（投機目的ではない）
- **Burn: 原則なし**
  - 緊急時の回収設計を除き、通常運用では実施しない
- ガバナンス:
  - ミント上限・期間上限（例: 月次上限）を事前定義
  - ミント実行はマルチシグ承認を必須化


### 3.5 USDC準拠の安全性設計（stablecoin運用向け）

USDCの実運用で重視される「発行統制・凍結対応・監査性」を参考に、`GCC` も以下を必須要件とする。

- 発行統制（Mint Controller）
  - `MINTER_ROLE` を分離し、Safeマルチシグ経由でのみ付与/剥奪
  - ミンターごとの `mintAllowance` を設定（上限超過mintを不可能化）
  - グローバル `supplyCap` と期間cap（日次/月次）を併用
- 停止/制限（Pause + Blocklist）
  - `PAUSER_ROLE` による緊急停止（transfer/mint/burnを段階制御）
  - 制裁・不正対応用に `BLOCKLISTER_ROLE` を実装（アドレス凍結）
  - Blocklist操作は常時オンチェーン記録 + 監査ログ公開
- 資産保全（Rescue / Upgrade Safety）
  - 誤送金トークン救出は対象を厳格限定（GCC本体は救出不可）
  - Upgrade可能にする場合は `UUPS + Timelock + Safe承認` を必須化
  - 可能なら初期は non-upgradeable で開始し、変更点を最小化
- 運用監査（Proof & Reconciliation）
  - `credits` 台帳残高とオンチェーン残高の定期照合
  - 供給量、トレジャリー残高、LP残高を日次で公開
  - 重要操作（mint/pause/blocklist）は週次レポート化

> 方針: 「価格上昇」ではなく「停止できる安全性・追跡可能性・運用透明性」を優先する。

### 3.6 USDC実装コード再利用方針（監査コスト最小化）

安全性と監査効率を優先し、`GCC` のトークン実装は独自実装ではなく、公開されているUSDC実装（`circlefin/stablecoin-evm`）を**そのまま利用**する。

- 採用実装: `FiatTokenV2_2` + `FiatTokenProxy`
- 運用: Safeを owner / pauser / blacklister / masterMinter に設定
- ミント: Safeが `configureMinter` を実行し、許容量内でminterが発行

---

## 4. 購入・swap導線（Ethereum）

## 4.1 DEX上場

- Uniswap v3 に `GCC/USDC`, `GCC/WETH` プール作成
- 初期流動性はSafe配下資産から供給
- 価格レンジを複数ティックに分けて集中流動性を設計

### 4.2 アプリ内導線

`etzhayyim-project-web3-llm` UI には以下を実装。

- Wallet接続（EOA/Safe App）
- `Buy GCC` ボタン（USDC→GCC swap）
- `Swap` 画面（GCC↔USDC, GCC↔WETH）
- 価格表示（DEX TWAP + 外部oracle補助）
- 請求表示はUSD建て + 実決済GCC換算（安定運用を優先）

### 4.3 Safe運用

- LPポジションNFT, 手数料収益, トレジャリー残高は
  `0xA00366234D29d4F882088048c0B2fa0dB7302D4E` で集約管理
- 実行権限はマルチシグ閾値（例: 2/3, 3/5）で管理

---

## 5. プロトコル連携設計

### 5.1 etzhayyim-project-credits

- 役割:
  - 残高台帳
  - 利用料金計算
  - 取引履歴
- Ethereum連携:
  - `Deposit`: ユーザーがGCC入金 → クレジット残高反映
  - `Withdraw`: クレジット引出し要求 → GCC送金

### 5.2 etzhayyim-project-web3-llm

- 役割:
  - 推論ジョブ実行
  - worker報酬計算
- Ethereum連携:
  - ジョブ開始時に見積りGCCをロック
  - 実績使用量で精算（余剰は返却）
  - worker報酬をバッチ分配（ガス最適化）
  - 推論実行で新規発行は行わず、既存供給から決済・再配分

---

## 6. コントラクト最小構成

1. `GCCToken`（ERC-20）
2. `Treasury`（Safe運用、受領・再配分）
3. `PaymentRouter`（アプリ決済導線）
4. `RewardDistributor`（worker報酬）

要件追記:

- `GCCToken` は Mintable（AccessControl + Cap必須）
- `GCCToken` は Blocklist / Pause / MintAllowance を実装
- `Treasury` は価格安定オペレーション方針を保持

オプション:

- Permit（EIP-2612）
- メタトランザクション対応
- 将来的なL2ブリッジ拡張

---

## 7. リスク管理・ガバナンス

- 監査必須対象:
  - ERC-20実装
  - PaymentRouter
  - RewardDistributor
- オペレーション:
  - Safeの署名者分散
  - 緊急停止（pause）権限の明確化
  - blocklist権限の限定（法令/不正対応時のみ）
  - 価格急変時のスリッページ上限
  - 重要操作（mint/pause/blocklist）の監査ログ定期公開

---

## 8. ローンチ段階（推奨）

### Phase 1: クローズド

- GCC発行
- `GCC/USDC` 小規模LP
- web3-llm内でBuy導線のβ公開

### Phase 2: パブリック

- `GCC/WETH` 追加
- worker報酬をオンチェーン分配へ移行
- Dune/Flipsideで可視化ダッシュボード公開

### Phase 3: 最適化

- 手数料設計最適化（価格安定性優先のパラメータ調整）
- L2展開（Arbitrum/Base）
- クロスチェーン流動性戦略

---

## 9. KPI

- 日次GCC出来高（DEX）
- GCC保有アドレス数
- web3-llm推論あたり平均GCC消費
- worker報酬分配コスト（gas/job）
- GCC価格乖離率（対USD基準）
- トレジャリー健全性（流動性維持に必要な残高比率）
- mint実行回数/量（期間cap内遵守率）
- pause復旧時間（MTTR）
- blocklist運用件数（理由分類付き）

---

## 10. まとめ

Ethereumで購入・swap可能にする最短ルートは、**ERC-20 `GCC` + Uniswap v3 (`GCC/USDC`, `GCC/WETH`) + Safeトレジャリー運用**。

この構成により、

- ユーザーはUSDC/WETHから即時にGCC取得可能
- `credits` は会計レイヤとして残高/課金を管理
- `web3-llm` はGCCベースの需要とworkerインセンティブを統合
- GCCは値上がり狙いではなく、stable coin的な運用通貨として機能

でき、両プロジェクトを単一トークン経済圏で接続できる。
