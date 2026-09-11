# app-credits

Two Cloudflare Worker appviews for the (legacy) etzhayyim credit ledger, plus
two trees that are **not** appviews and are not part of the migration below.

**Neither Worker deploys today**, and that is not what this migration changed —
see §5. What changed is that the code you read is now the code that would be
deployed, and that claim is checked rather than asserted.

Everything on this page was measured on **2026-08-18** against commit `bb4f922`
(before) and this branch (after). `kbb --backend sci scripts/verify-docs-claims.cljk .`
re-derives every number here from the tree and exits 1 if the prose and the tree
disagree.

---

## 1. What is here

81 tracked files (`git ls-files | wc -l`):

| Path | Files | What it is | In this migration? |
|---|---:|---|---|
| `evm/` | 45 | 1 own Solidity contract + Circle's USDC vendored verbatim | **no — see §4** |
| top level | 12 | `README.md`, `CLAUDE.md`, `deps.edn`, `shadow-cljs.edn`, … | docs/build config |
| `kotoba/` | 7 | a standalone TypeScript credits library, 594 lines + 153 of test | **no — see §4** |
| `appview/` | 6 | two Worker configs + descriptors + READMEs | yes (configs rewritten) |
| `src/credits/` | 5 | the two Workers, in ClojureScript | **yes — this is the migration** |
| `scripts/` | 3 | the render helper and two gates | yes |
| `docs/` | 2 | this ADR and the operator quickstart | yes |
| `test/` | 1 | the route/view test suite | yes |

## 2. The migration: TypeScript/Svelte → ClojureScript

Decision and full measurements: `docs/adr/0001-migrate-the-appview-from-typescript-to-clojurescript.edn`.

```
src/credits/route.cljc          which handler answers (per-app route tables) — pure
src/credits/view.cljc           the page (jp-go-dds hiccup) — pure
src/credits/edge.cljs           the only Request/Response layer
src/credits/mcp_worker.cljs     entry for credits-mcp-component
src/credits/wallet_worker.cljs  entry for the wallet
        ↓ shadow-cljs :target :esm, two builds
dist/credits/worker.js          ← appview/credits-mcp-component/wrangler.jsonc  main
dist/wallet/worker.js           ← appview/etzhayyim-wasm-wallet-wt1e2f3g/wrangler.jsonc main
```

**Before, both `main`s pointed at `svelte/.svelte-kit/cloudflare/_worker.js` — a
SvelteKit build artifact that is committed nowhere in this tree** (`find . -name
.svelte-kit` → 0 hits). The file that read like the application,
`appview/*/src/app.ts`, was named by no `package.json` and was in no bundle at
all. Those were two different programs, and neither was the one you could read.

Language, measured (production source, excluding `scripts/`):

| | before (`bb4f922`) | after |
|---|---:|---:|
| appview TypeScript files | 6 (149 lines) | **0** |
| appview Svelte files | 3 (111 lines) | **0** |
| Svelte build config / lockfile | 11 | **0** |
| ClojureScript / cljc files | 0 | **6** (508 lines) |
| `kotoba/` TypeScript files | 5 | **5** (untouched) |

### What each Worker answers

The two apps do **not** share a route table, because they did not before:
`credits-mcp-component`'s deployed face had no server route at all (one
`+page.svelte`), while the wallet had `xrpc/[...path]/+server.ts`.

| | `GET /` | `GET /health` | `POST /xrpc/:nsid` | `OPTIONS /xrpc/*` |
|---|---|---|---|---|
| `credits-mcp-component` | page | JSON | **404 — never had it** | **404** |
| `etzhayyim-wasm-wallet-wt1e2f3g` | page | JSON | relay to MCP router | 204 preflight |

`/health` is the one route that is an **addition, not a port** — the deployed
SvelteKit face had none (`src/app.ts` did). It exists so an operator can check
that the deployed face answers. It needs no upstream and no binding.

Multi-segment XRPC paths are **relayed, not rejected**: SvelteKit's `[...path]`
forwarded `/xrpc/a/b` verbatim, and only the empty string was a 400. Narrowing
that would be a policy change, not a migration. Measured under `wrangler dev
--local`: `/xrpc/a/b` → 502 (upstream unreachable), not 400.

### Routes deliberately not carried over

| Dropped | Measured reason |
|---|---|
| every route in `appview/*/src/app.ts` (`/_app/meta`, `/healthz`, the `com.etzhayyim.apps.credits.*` dispatcher proxy, the wallet's `WALLET_TO_CREDITS` NSID map and its 501) | in no bundle; `DISPATCHER_URL` / `DISPATCHER_INTERNAL_SECRET` are declared in **neither** `wrangler.jsonc`; `dispatcher.etzhayyim.com` has no A record |
| the `assets` block (static serving + SPA fallback) | pointed at `svelte/.svelte-kit/cloudflare/client`, which is not in the tree and is no longer generated |
| `compatibility_flags` `nodejs_compat` / `nodejs_als` | adapter-cloudflare's requirement. The cljs bundles import no `node:` builtin (0 hits for `node:`, `require(`, `process.`, `Buffer`). **Verified by running both under `wrangler dev --local` with the flags removed and hitting every route** — §S7 of the quickstart |

### The defect this kills

The wallet's page carried its facts as literals:

```js
const app = { "routeCount": 0, "routes": [], "vars": [] };
```

and rendered *Routes 0* and *No public route is declared* next to a
`wrangler.jsonc` declaring a route pattern and 8 vars. The cljs page takes the
route table as an argument and derives the count with `(count routes)`; the
heading, description and nanoid are `env` values, not baked strings. There is no
literal left for the config to drift away from.

## 3. Gates

All four run offline. `docs/operator-quickstart.md` has the exact commands and
their real output, including each gate shown failing.

| Gate | Command | Result |
|---|---|---|
| tests | `kbb --backend sci --classpath … -e '(run-tests …)'` | 8 tests, 39 assertions, 0 failures |
| page quality | `design-quality.cli score … --min 95` | **100.00**, 12/12 axes with `--extra-axes` |
| build | `resource-guard … amu compile --target wasm32-browser credits-worker wallet-worker` | both bundles, 0 warnings, `:warnings-as-errors true` |
| smoke | `kbb --backend sci scripts/smoke-worker.cljk .` | 39 checks against the **built** bundles |
| docs | `kbb --backend sci scripts/verify-docs-claims.cljk .` | 31 claims re-derived from the tree |

## 4. What was deliberately left alone

The instruction that produced this migration was about **the appview**. Two
trees here are not the appview, and deleting them because they share a file
extension would be destruction, not migration.

- **`kotoba/`** — 7 files; 594 lines of TypeScript + 153 of test; a *c-split*
  credits model (public catalog + per-person sealed ledger). It is imported by
  **neither** appview, is in **no** bundle here, and its one production
  dependency is a **type-only** import (`kotoba/src/registry.ts:17` is
  `import type { Etzhayyim } from "@etzhayyim/sdk"`), so it resolves and its
  vitest suite runs. It is not dead. Migrating it is a separate decision that
  needs a cljs face for `@etzhayyim/sdk` first.
- **`evm/`** — 45 files, 42 of them `.sol`: one own contract
  (`contracts/GCCStablecoin.sol`) and Circle's `stablecoin-evm` vendored
  verbatim (`evm/third_party/usdc/UPSTREAM.md`). Not code this repository owns.

Both are **pinned by file count in `scripts/verify-docs-claims.cljs`**, in both
directions, so neither can grow or shrink without a gate noticing. Confirmed
byte-identical to `bb4f922`: `git diff bb4f922 -- kotoba evm` is empty.

## 5. Why it still does not deploy

The migration did not change this, and does not claim to. Measured 2026-08-18:

| Host | Role | A record |
|---|---|---|
| `credits.etzhayyim.com` | route, credits Worker | **none** |
| `a5ce95af.etzhayyim.com` | route, and `APP_EMBED_URL` | **none** |
| `wt1e2f3g.etzhayyim.com` | route, wallet Worker | **none** |
| `mcp.etzhayyim.com` | the wallet's XRPC relay target | **none** |
| `dispatcher.etzhayyim.com` | upstream of the dropped `src/app.ts` | **none** |
| `etzhayyim.com` | apex | 104.21.51.111, 172.67.179.128 |

The zone is alive; these five names are not in it. Deploying would publish a
Worker whose every outbound path fails at the first hop. The relay says so
rather than hiding it — with the upstream unreachable, `POST /xrpc/<nsid>`
returns **502**, not a 200 with an empty body.

**New value flows go to `orgs/cloud-itonami/credits`** (the ENGI mutual-credit
kernel), which states it "replaces the centrally issued GCC/credit model". This
repository's `CLAUDE.md` describes the superseded design.
