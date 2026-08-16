# credits-mcp-component

`60-apps/etzhayyim-project-credits/legacy-runtime/etzhayyim-credits-z8l65qxz` の App 版コンポーネントです。

## Core Policy

- Credits 購入時は 30% を platform fee として控除し、70% を GCC として wallet に計上
- Credits 消費時は 10% を `etzhayyim-project-public-fund` に自動分配
- 10% の分配先は user が `credits` UI で選択可能
- 分配先未指定時は `public-fund:common` を使用

## Endpoints

`src/app.ts` が実装しているのはこの 3 つだけ:

- `GET /health`
- `GET /_app/meta`
- `GET|POST /xrpc/com.etzhayyim.apps.credits.*` — `DISPATCHER_URL`
  （既定 `https://dispatcher.etzhayyim.com`）へ転送する。それ以外は 404

`/healthz`・`/readyz`・`/api/mcp` はここには無い。以前この節が挙げていたが、
`grep -rl` でこの README 以外の 1 ファイルにも出てこない。

## Svelte console

`svelte/` の SvelteKit app は route が 1 本（`src/routes/+page.svelte` →
`src/App.svelte`）で、`<h1>` と "Vite entry scaffold after SvelteKit cleanup."
を描画するだけ。`/api/plans`・`/api/balance/{userId}` という route は無く、
`wasm/` というディレクトリも無い（`appview/` である）。

⚠ `wrangler.jsonc` の `main` はこの SvelteKit のビルド成果物
（`svelte/.svelte-kit/cloudflare/_worker.js`）であって `src/app.ts` ではない。
**deploy されるのは上の `src/app.ts` ではなくこの console である。**

## MCP commands

下の名前は dispatcher 側の NSID であって、この repo の実装ではない。
14 個のうちこの repo に文字列として存在するのは `GetBalance` 1 つだけで、
それも `kotoba/src/types.ts` の型名（`GetBalanceInput` / `GetBalanceOutput`）。

- `GetBalance`
- `PurchaseCredits`
- `SpendCredits`
- `CheckSpendAllowed`
- `EarnCredits`
- `RewardFromCompute`
- `RewardFromHC`
- `ListTransactions`
- `GetAllocationOptions`
- `GetAllocationPreference`
- `SetAllocationPreference`
- `PreviewPurchase`
- `PreviewSpend`
- `GetDefaultPlan`

## Query aliases

- `credits.balance`
- `credits.transactions`
- `credits.plan`
- `credits.allocation-options`
- `credits.allocation-preference`

## Allocation Destinations

- `public-fund:common`
- `public-fund:education-family`
- `public-fund:health-access`
- `public-fund:climate-resilience`

## Notes

- App runtime 依存は除去し、MCP 中心の App 構成に寄せています。
- **ledger は `src/app.ts` には無い。** `src/app.ts` は 25 行の転送 facade で、
  自分の 1 行目にそう書いている（"Ledger and reward logic run in AgentGateway
  MCP + pod-side LangServer"）。この repo にある唯一の ledger 実装は
  `kotoba/`（594 行 + 8 tests）。
- この Worker は現状 deploy できない: `main` のビルド成果物が commit されて
  おらず、`credits.etzhayyim.com` / `a5ce95af.etzhayyim.com` /
  `dispatcher.etzhayyim.com` はいずれも A レコードを持たない（2026-08-16 実測）。
  経緯と後継は `docs/operator-quickstart.md`。
