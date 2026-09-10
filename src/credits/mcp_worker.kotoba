(ns credits.mcp-worker
  "credits-mcp-component の入口。`appview/credits-mcp-component/wrangler.jsonc`
  の main が指す bundle。

  この app は XRPC の中継を持たない —— deploy されていた SvelteKit の面には
  server route が 1 本も無かった（`src/routes/+page.svelte` の 1 枚だけ）。
  `src/app.ts` の方には dispatcher への中継があったが、それはどの bundle にも
  入っておらず、binding も宣言されておらず、宛先も DNS に無い。移していない
  理由は README.md に測定値付きで書いてある。"
  (:require [credits.edge :as edge]
            [credits.route :as route]))

(defn fetch-handler [req env ctx]
  (edge/handle route/credits-app req env ctx))

(def handler #js {:fetch fetch-handler})
