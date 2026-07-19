# credits-mcp-component

`60-apps/etzhayyim-project-credits/legacy-runtime/etzhayyim-credits-z8l65qxz` の App 版コンポーネントです。

## Core Policy

- Credits 購入時は 30% を platform fee として控除し、70% を GCC として wallet に計上
- Credits 消費時は 10% を `etzhayyim-project-public-fund` に自動分配
- 10% の分配先は user が `credits` UI で選択可能
- 分配先未指定時は `public-fund:common` を使用

## Endpoints

- `GET /health`
- `GET /healthz`
- `GET /readyz`
- `POST /api/mcp`
- `POST https://{nanoid}.etzhayyim.com/api/mcp`

## Svelte Demo Console API

`wasm/credits-mcp-component/svelte` 配下の SvelteKit console では、UI preview 用に次の route を返します。

- `GET /api/plans`
- `GET /api/balance/{userId}`

## MCP commands

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
- ledger の本体は `src/app.ts` の command / query で管理し、Svelte 側 `/api/*` は preview / demo 用です。
- UI 側の分配先保存は現状 localStorage を使います。
