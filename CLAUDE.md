> **DEPRECATED — everything below is the superseded design.** New value flows go
> to **`orgs/cloud-itonami/credits`** (the ENGI mutual-credit kernel), whose
> README states it "replaces the centrally issued GCC/credit model". The 30%
> purchase fee, the admin minter and the Safe treasury described below are
> legacy migration inputs, not the target design.
>
> The pointer here used to read `orgs/etzhayyim/com-etzhayyim-credits/…`. That
> path does not exist and is not in `manifest/west.yml` — the repository moved
> orgs, and only GitHub's name redirect kept it looking valid
> (`gh api repos/etzhayyim/com-etzhayyim-credits --jq .full_name` →
> `cloud-itonami/credits`). The appviews also live under `appview/`, not
> `wasm/`, and neither of them currently deploys.
>
> **Start at `docs/operator-quickstart.md`** — it records what is here, what
> runs, and what the hosts and contracts named below actually resolve to.
>
> 2026-08-18: 2 つの appview を TypeScript/Svelte から **ClojureScript** へ
> 移した（`docs/adr/0001`、`README.md`）。下の legacy 設計の記述は当時の
> 設計記録として残してあるが、**runtime の記述は下の「Appview runtime」節が
> 正本**である。

# etzhayyim-project-credits — Credit Ledger & Public Fund Routing

**URL**: `https://credits.etzhayyim.com` — ⚠ no A record as of 2026-08-16.

## Architecture

Credits は yoro.etzhayyim.com の human participation 課金システム。Earn (compute/HC) → Purchase → Spend のクレジットサイクルを管理する。

2026-03-30 時点の標準ポリシー:

- credits 購入時は 30% を platform fee として控除
- credits 消費時は 10% を `etzhayyim-project-public-fund` に自動分配
- 10% の分配先は user が `credits` UI で選択可能
- 分配先未指定時は `public-fund:common` を使用

| Component | nanoid | 役割 |
|---|---|---|
| **credits-mcp** | `credits-mcp` | Credit ledger, transactions, anti-fraud, purchase fee, public-fund routing |
| **GCC Wallet** | `wt1e2f3g` | Ethereum ERC-20 (GCC token), HD wallet, Chainlink price |

## Commands (credits-mcp)

### Queries
| Command | 入力 | 出力 | 用途 |
|---|---|---|---|
| `GetBalance` | `user_id` | `{balance, user_id}` | クレジット残高取得 |
| `ListTransactions` | `user_id, limit, offset` | `{transactions[], total}` | 取引履歴 |
| `GetDefaultPlan` | — | `{default_plan}` | 購入 fee / 分配 policy の参照 |
| `CheckSpendAllowed` | `user_id, action, amount?` | `{allowed, reason?, balance, cost}` | 消費可否 |
| `GetAllocationOptions` | — | `{options[], default_destination_id}` | public fund 分配先候補 |
| `GetAllocationPreference` | `user_id` | `{preference}` | user の分配先 |
| `PreviewPurchase` | `gross_amount` | `{purchase}` | 30% fee 控除見積 |
| `PreviewSpend` | `user_id?, action, amount?, destination_id?` | `{spend, destination}` | 10% 分配見積 |

### Mutations
| Command | 入力 | 出力 | 用途 |
|---|---|---|---|
| `EarnCredits` | `user_id, amount, source, description` | `{balance, tx_id}` | 任意 source から付与 |
| `PurchaseCredits` | `user_id, gross_amount, source?, destination_id?` | `{balance, tx_id, purchase}` | 30% fee 控除購入 |
| `SpendCredits` | `user_id, amount?, action, destination_id?` | `{balance, tx_id, allocation, destination}` | 10% 分配付き消費 |
| `RewardFromHC` | `user_id, task_id, contribution_type, amount?, approval_rate` | `{balance, tx_id, amount}` | HC 報酬 |
| `RewardFromCompute` | `user_id, session_id, jobs_done, gpu_time_ms, amount?, source` | `{balance, tx_id, amount}` | compute 報酬 |
| `SetAllocationPreference` | `user_id, destination_id` | `{preference}` | 分配先の保存 |

## Purchase / Allocation Policy

| Flow | Rule |
|---|---|
| Credits purchase | 30% を控除し、70% を wallet に計上 |
| Credits spend | 消費額の 10% を public fund に自動分配 |
| Distribution target | user が `credits` ページで選択 |
| Default target | `public-fund:common` |

### Allocation Destinations

| destination_id | Label | Role |
|---|---|---|
| `public-fund:common` | Common Fund | デフォルトの共通 fund |
| `public-fund:education-family` | Education & Family Fund | 教育・子育て向け |
| `public-fund:health-access` | Health Access Fund | 医療アクセス向け |
| `public-fund:climate-resilience` | Climate Resilience Fund | 防災・環境向け |

## Credit Rates

### Earn

| Source | Rate |
|---|---|
| HC translation | ¥3 |
| HC code review | ¥5 |
| HC micro task | ¥2 |
| HC moderation | ¥1 |
| HC survey | ¥0.5 |
| Murakumo per job | ¥0.1 |
| Murakumo GPU per min | ¥0.3 |

### Spend

| Action | Cost |
|---|---|
| Post | ¥1 |
| Reply | ¥0.5 |
| DM | ¥0.5 |

## Anti-Fraud

| 対策 | 閾値 |
|---|---|
| Spend rate limit | 60 回/hour |
| Earn rate limit | 30 回/hour |
| High-value earn reject | > 50 credits |
| HC reputation gate | `approval_rate < 50%` |
| Duplicate reward | 同一 task/session を拒否 |

## Appview runtime — ClojureScript（2026-08-18 移行）

**この節は以前「Svelte Demo Console」だった。その console はもう存在しない。**

2 つの appview は TypeScript/Svelte から ClojureScript へ移行済み
（`docs/adr/0001`）。deploy される bundle は、いま読めるソースから
**shadow-cljs** がコンパイルしたものである。

| appview | wrangler `main` | entry |
|---|---|---|
| `appview/credits-mcp-component` | `../../dist/credits/worker.js` | `src/credits/mcp_worker.cljs` |
| `appview/etzhayyim-wasm-wallet-wt1e2f3g` | `../../dist/wallet/worker.js` | `src/credits/wallet_worker.cljs` |

判断は `src/credits/route.cljc`、ページは `src/credits/view.cljc`（jp-go-dds）、
Request/Response に触るのは `src/credits/edge.cljs` と 2 つの entry だけ。

移行前にここに書かれていた `/api/plans`・`/api/balance/{userId}` は、この repo の
どのソースにも存在しなかった（`grep -rl` で実測、2026-08-16／2026-08-18 に再確認）。
新しい面が答えるルートは `README.md` の表が正本で、その表は Worker の route 表
そのものから描かれている。

⚠ **`kotoba/` と `evm/` はこの移行の対象外**。どちらも appview の bundle に
入っておらず、置き換えた対象から参照もされていない。削っていない理由と実測は
`README.md`。

## Integration

### yoro.etzhayyim.com → credits-mcp

```txt
Header Credits button → /credits
Post/Reply/DM → CheckSpendAllowed → SpendCredits
Credits page → SetAllocationPreference / PreviewPurchase / PreviewSpend
```

### hc.etzhayyim.com → credits-mcp

```txt
approve-assignment → RewardFromHC
```

### murakumo.etzhayyim.com → credits-mcp

```txt
Browser session end → RewardFromCompute
```

## Data Model

| Record | Key | Fields |
|---|---|---|
| `credit_wallet` | user_id | balance |
| `credit_transaction` | tx_id | type, amount, source, description |
| `af_event` | ts | earn/spend anti-fraud event |
| `allocation_preference` | user_id | destination_id, title, allocation_bps |
| `purchase_settlement` | tx_id | gross_amount, fee_amount, net_credits |
| `public_fund_allocation` | allocation_id | spend_tx_id, public_fund_amount, destination_id |

## GCC Token (Ethereum)

| Item | Address |
|---|---|
| GCC Token | `0x799d24a6FFBb758C6E2Ed8f981822A17Eaa5F30B` |
| GCC Minter | `0xAf80b152eD85067F8386416767b9658E86C253d9` |
| Safe Treasury | `0xA00366234D29d4F882088048c0B2fa0dB7302D4E` |
| Chainlink ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |

Design: `TOKEN_DESIGN_ETHEREUM.md`
