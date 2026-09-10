(ns credits.wallet-worker
  "etzhayyim-wasm-wallet-wt1e2f3g の入口。
  `appview/etzhayyim-wasm-wallet-wt1e2f3g/wrangler.jsonc` の main が指す bundle。

  この app は XRPC の中継を持つ。移行前の
  `svelte/src/routes/xrpc/[...path]/+server.ts` が deploy される面に居たので、
  これは移行の対象であって新機能ではない。中継先 AGENTGATEWAY_MCP_ROUTER_URL は
  wrangler.jsonc に宣言されている（宛先 mcp.etzhayyim.com は今日 DNS に無い
  —— README.md に実測を書いた）。"
  (:require [credits.edge :as edge]
            [credits.route :as route]))

(defn fetch-handler [req env ctx]
  (edge/handle route/wallet-app req env ctx))

(def handler #js {:fetch fetch-handler})
