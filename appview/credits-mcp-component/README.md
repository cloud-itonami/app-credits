# credits-mcp-component

`kotodama-a5ce95af`。**ClojureScript の Cloudflare Worker**（2026-08-18 に
TypeScript/Svelte から移行、`../../docs/adr/0001`）。

- entry: `../../src/credits/mcp_worker.cljs`
- bundle: `../../dist/credits/worker.js`（`wrangler.jsonc` の `main` が指す先）
- 判断: `../../src/credits/route.cljc` の `credits-app`

## この Worker が答えるもの

| method | path | 何をするか |
|---|---|---|
| `GET` | `/` | この appview の説明ページ（jp-go-dds） |
| `GET` | `/health` | `{"ok":true,"app":"credits-mcp-component","runtime":"cljs","routes":[…]}` |

それ以外は 404。**XRPC はここには無い** —— `/xrpc/…` は 404 を返す。

なぜ 404 で、405 でも 400 でもないのか: 移行前に deploy されていた面
（SvelteKit のビルド出力）には server route が 1 本も無く、`src/routes/+page.svelte`
1 枚だけだった。XRPC の中継は**このコンポーネントには存在したことがない**ので、
『あるがいまは使えない』に読ませない。中継を持つのは隣の
`etzhayyim-wasm-wallet-wt1e2f3g` の方。

`/health` は deploy されていた面には無かった（`src/app.ts` にはあった）。
**1 つだけの新規追加**で、deploy された面が答えることを外から確かめるために
入れてある。

## 移行時に持ち越さなかったもの

`src/app.ts`（25 行）にあった `/_app/meta` と
`GET|POST /xrpc/com.etzhayyim.apps.credits.*` の dispatcher 中継は移していない。
理由が 3 つ重なる:

1. どの bundle にも入っていなかった（`main` は SvelteKit のビルド出力を指す）
2. `DISPATCHER_URL` / `DISPATCHER_INTERNAL_SECRET` は `wrangler.jsonc` に
   **宣言が無い**
3. 宛先 `dispatcher.etzhayyim.com` は A レコードを持たない（2026-08-18 実測）

`assets` block（`svelte/.svelte-kit/cloudflare/client` の静的配信と SPA
fallback）も外した —— 指していたディレクトリはこの tree に無く、Svelte を
撤去した今は生成もされない。

## ledger はここには無い

移行前のこの README が挙げていた 14 の MCP コマンド（`GetBalance`,
`PurchaseCredits`, …）は dispatcher 側の NSID であって、この repo の実装では
ない。14 個のうちこの repo に文字列として存在するのは `GetBalance` 1 つだけで、
それも `../../kotoba/src/types.ts` の型名（`GetBalanceInput` / `GetBalanceOutput`）。

この repo にある唯一の ledger 実装は `../../kotoba/`（594 行 + 8 tests）で、
**appview ではないのでこの移行の対象外**（`../../README.md` §4）。

## deploy

**できない。** `credits.etzhayyim.com` も `a5ce95af.etzhayyim.com` も A レコードを
持たない（2026-08-18 実測、`../../README.md` §5）。ローカル起動と全ルートの
確認は `../../docs/operator-quickstart.md` S7。
