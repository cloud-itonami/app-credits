# GCCStablecoin Safe発行ランブック

## 目的

USDC運用モデルに近い発行統制で、Safeから `GCCStablecoin` を発行できるようにする。

対象Safe:
- `0xA00366234D29d4F882088048c0B2fa0dB7302D4E`

## デプロイ時パラメータ（推奨）

- `name`: `etzhayyim Computing Credit`
- `symbol`: `GCC`
- `decimals`: `6`（USDC互換の会計運用）
- `supplyCap`: 例 `10_000_000_000 * 10^6`
- `owner`: Safeアドレス
- `masterMinter`: Safeアドレス
- `pauser`: Safeアドレス
- `blacklister`: Safeアドレス

## 役割設計

Safeを運用コントローラにし、発行実務だけ別EOA/運用Botに委譲する。

1. Safeが `configureMinter(minter, allowance)` を実行
2. minterが `mint(to, amount)` を実行
3. allowance消費後はSafeが再設定
4. 重大事案時はSafeが `pause` / `blacklist` を実行

## 最低限の運用ルール

- ミンターは用途別に分離（LP補填用、報酬配布用など）
- allowanceは短期間・小刻みに設定（週次/日次）
- mint実行ログを週次公開
- 緊急停止復旧手順を事前に手順化

## 実行例（ABI呼び出し）

- Safe Tx 1: `configureMinter(0xMinter, 500000000000)`
- Minter Tx: `mint(0xTreasuryHotWallet, 100000000000)`
- Safe Tx 2: `removeMinter(0xMinter)` （必要に応じて）

> 注: 上記数値は `decimals=6` 前提。
