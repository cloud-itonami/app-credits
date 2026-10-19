# app-credits — itonami（dapp）上の分散型設計

状態: 第 1 スライス実装（2026-10-19）。正本はこの文書。
追跡: Linear JUN-118（親 JUN-116「itonami dapp 整備プログラム」）。

## 位置づけと設計の正本

app-credits は itonami（dapp）の app bundle であり、独立 dapp ではない
（ADR 0007 / 0008）。層の全体像は `network-awai-apex/docs/dapp-architecture-map.md`。

この app の判断の正本は **TOKEN_DESIGN_BASE.md の 3 単位の型と膜規則**
（ADR-2608291009 / ADR-2608311800、Base `eip155:8453`）。AGENTS.md 冒頭の
DEPRECATED は旧 GCC/30% fee モデルの話で、BOT/KUMO/YATA の膜規則は現行。
「ここに無い流れは実装しない」が規則の形である。

## このスライスで実装したもの

| 層 | 実体 | 状態 |
|---|---|---|
| 判断コア guest | `aiueos/credits_membrane.cljk` — 膜通過判定（:refused / :exchange / :one-way-mint）+ x402 の BOT burn 判定。`:effects #{}`、fail closed | **実装済み・実測** |
| アプリ記述子 | `aiueos/credits.edn`（notes.edn 形、`:aiueos/kind :app`） | **実装済み**。session/grant 配線は未実装 |
| appview adapter | `src/credits/membrane.cljk`（keyword API）+ parity fixture | **実装済み・実測** |
| wasm 産物 | `aiueos/credits_membrane.wasm` + provenance | **実装済み** |

## 実測（2026-10-19、このスライスで実行したもの）

- `amu check aiueos/credits_membrane.cljk` → `:ok true`, `:effects #{}`。
- `amu test aiueos/credits_membrane.cljk` → **24/24 passed**
  （test 8 本 × targets `[:jvm-kir :js :wasm]`）。
- `amu compile --target wasm32-browser` → wasm（MVP module）+ provenance。
- kbb `test/run_tests.cljk`（`credits.membrane-test`）→ 5 tests / 20 assertions,
  0 failures。

## 未実装境界（このスライスでは触れていない）

- **aiueos への配線**（app catalog / grant 経路）は未実施。
- **mint / burn / credit の実行**: BOT → KUMO/YATA は 2 段（on-chain BOT burn +
  台帳 credit）で実装する設計だが、どちらも本スライスの外。x402 の burn
  も判定（`x402-burn-due`）まで。
- **決済面**: Base の BOT contract（EIP-3009 wire）と Safe は
  `evm/`（GCC legacy）と TOKEN_DESIGN_BASE の計画にあり、dapp からの
  接続は未実装。旧 chain 260425 は decommissioned 済み。
- **awai network 配置**: 膜判定の結果（decision）を `ito`（署名 source chain）
  にどう残すかは未設計。
- **既存テストの gate 配線**: `credits.route-test` は `kotoba.lang.text` の
  kbb classpath 配線が要り、このスライスの runner には含めていない
  （`test/run_tests.cljk` の注記どおり）。

## 次の一手

1. 2 段変換（BOT burn + credit）の状態機械を guest に追加。
2. decision の `ito` 記録（署名 source chain への append 仕様）。
3. aiueos app catalog への載せ（kotoba-lang/aiueos 側）。
