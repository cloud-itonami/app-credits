# app-credits — appviews

2 つの Cloudflare Worker appview。**どちらも ClojureScript**（2026-08-18 に
TypeScript/Svelte から移行、`../docs/adr/0001`）。

| ディレクトリ | Worker 名 | entry | bundle |
|---|---|---|---|
| `credits-mcp-component` | `kotodama-a5ce95af` | `../src/credits/mcp_worker.cljs` | `../dist/credits/worker.js` |
| `etzhayyim-wasm-wallet-wt1e2f3g` | `kotodama-wt1e2f3g` | `../src/credits/wallet_worker.cljs` | `../dist/wallet/worker.js` |

各ディレクトリに残っているのは `wrangler.jsonc` と `kotodama.jsonld` だけで、
**ソースはここに無い** —— 2 つの Worker は判断（`route.cljc`）とページ
（`view.cljc`）と Request/Response 層（`edge.cljs`）を共有し、entry だけが
別だからである。共有部を 2 箇所にコピーすると、片方だけ直る状態が作れてしまう。

## 移行前にここにあったもの

`svelte/`（SvelteKit）と `src/app.ts`。**どちらも deploy されていなかった** ——
`wrangler.jsonc` の `main` は `svelte/.svelte-kit/cloudflare/_worker.js` という
**この tree に commit されていないビルド成果物**を指しており、`src/app.ts` は
どの `package.json` の entry でもなかった。測定と撤去の理由は `../README.md` §2。

## この節が以前主張していて、実際には無かったもの

移行前のこの README は `POST /api/mcp`、30% platform fee の実装、10% の
public-fund 分配、preview console を「実装済みコンポーネント」として挙げて
いた。**これらはこの repo のどのソースにも無い。** 該当する NSID は dispatcher
側のもので、実装は
`40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/ingest/credits.py`
という分割前の monorepo のパスにある。この repo にある唯一の ledger 実装は
`../kotoba/`（TypeScript、594 行 + 8 tests）で、これは appview ではないので
移行の対象外（`../README.md` §4）。

## deploy

**できない。** route が指すホストも XRPC の中継先も DNS に無い
（`../README.md` §5 に 2026-08-18 の実測）。`wrangler dev --local` でローカルに
起動して全ルートを叩くことはできる —— 手順は `../docs/operator-quickstart.md` S7。
