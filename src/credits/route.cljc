(ns credits.route
  "Which handler answers a request — as data, decided by a pure function.

  This is `.cljc` and not `.cljs` on purpose. Routing is the part of an edge
  worker that is worth testing, and it is testable here without a browser, a
  build, or a network. `credits.mcp-worker` / `credits.wallet-worker` are the
  only namespaces that touch Request/Response, and they do nothing this file
  has not already decided.

  It is also the first thing that should move to `.kotoba` once the ingress
  capability qualifies (`:native-aot`/`:wasm-aot` are pending today —
  ADR-2606290000): a route table is a decision over scalars and strings,
  which is exactly the shape that survives that move.

  **この repo は appview を 2 つ持つ。** 片方(credits-mcp-component)は
  deploy される面に server route が 1 本も無く、もう片方(wallet)は XRPC の
  中継を持つ。だから route 表は app ごとの値で、`dispatch` はその値を受け取る
  —— どちらか一方を暗黙の既定にすると、もう一方が黙って間違う。"
  (:require [clojure.string :as str]))

;; ---------------------------------------------------------------------------
;; Route tables. The landing page renders THESE, so a route that exists and a
;; route the page advertises cannot drift apart — the defect docs/adr/0001
;; recorded was a page with `routeCount: 0` and `routes: []` baked in as
;; literals, beside a wrangler.jsonc declaring a route pattern and 8 vars.
;; ---------------------------------------------------------------------------

(def ^:private page-route
  {:route/path "/" :route/method :get :route/kind :page
   :route/doc "この appview の説明ページ"})

(def ^:private health-route
  {:route/path "/health" :route/method :get :route/kind :json
   :route/doc "生存確認。デプロイされた面が答えることを外から確かめられる"})

(def ^:private xrpc-route
  {:route/path "/xrpc/:nsid" :route/method :post :route/kind :proxy
   :route/doc "XRPC を MCP router へ中継する"})

(def credits-app
  "credits-mcp-component。deploy される面(SvelteKit のビルド出力)には
  server route が無く、`/` の 1 枚だけだった。XRPC の中継はここには**無い**
  —— app.ts 側にはあったが、それはどの bundle にも入っていない dead code で、
  宛先 dispatcher.etzhayyim.com も A レコードを持たない(README.md)。"
  {:app/id :credits-mcp
   :app/name "credits-mcp-component"
   :app/dir "appview/credits-mcp-component"
   :app/xrpc? false
   :app/routes [page-route health-route]})

(def wallet-app
  "etzhayyim-wasm-wallet-wt1e2f3g。deploy される面は `/` と
  `xrpc/[...path]`(POST + OPTIONS)の 2 本。中継先は
  AGENTGATEWAY_MCP_ROUTER_URL で、これは wrangler.jsonc に宣言されている。"
  {:app/id :wallet
   :app/name "etzhayyim-wasm-wallet-wt1e2f3g"
   :app/dir "appview/etzhayyim-wasm-wallet-wt1e2f3g"
   :app/xrpc? true
   :app/routes [page-route health-route xrpc-route]})

(defn- xrpc-nsid
  "`/xrpc/<nsid>` の nsid。**空文字だけが nil**。

  多段パス(`/xrpc/a/b`)も通す。移行前の SvelteKit route は rest parameter
  `[...path]` で受けており、`a/b` をそのまま tool 名として転送していた。
  ここで 1 セグメントに絞ると挙動が変わる —— NSID に `/` は現れないので
  上流で失敗するだけだが、**それは移行ではなく方針変更**であり、移行の commit に
  紛れ込ませるべきものではない。絞るなら別の決定として記録する。

  同型の移行(cloud-itonami/app-lo, app-ongakuka)で先にこう決まっており、
  こちらを合わせた。"
  [path]
  (when (str/starts-with? path "/xrpc/")
    (let [rest' (subs path (count "/xrpc/"))]
      (when (seq rest') rest'))))

(defn dispatch
  "app + method + path → 何をするか。Request も Response も知らない。

  返すのは `{:action …}` で、`:action` は
  `:page` / `:health` / `:xrpc` / `:cors-preflight` / `:not-found` /
  `:method-not-allowed` / `:bad-request` のいずれか。

  XRPC を持たない app に `/xrpc/...` が来たら `:not-found` —— 中継先を持たない
  のに 400 や 405 を返すと『あるがいまは使えない』に読めてしまう。"
  [{:app/keys [xrpc?]} method path]
  (let [m (keyword (str/lower-case (or method "get")))
        p (or path "")]
    (cond
      (str/starts-with? p "/xrpc/")
      (cond
        (not xrpc?) {:action :not-found}
        (= m :options) {:action :cors-preflight}
        (= m :post) (if-let [nsid (xrpc-nsid p)]
                      {:action :xrpc :nsid nsid}
                      {:action :bad-request :reason "XRPC method is missing"})
        :else {:action :method-not-allowed :allow "POST, OPTIONS"})

      (= p "/health") (if (= m :get)
                        {:action :health}
                        {:action :method-not-allowed :allow "GET"})
      (= p "/")       (if (= m :get)
                        {:action :page}
                        {:action :method-not-allowed :allow "GET"})
      :else {:action :not-found})))

(defn mcp-router-url
  "env の設定 → MCP router の URL。末尾スラッシュは落とす。

  既定値をここに焼くのは、設定が無いときに黙って何処かへ POST しないためで
  はなく、**どこへ行くのかを 1 箇所で読めるようにする**ため。呼び出し側は
  この戻り値をそのまま使う。"
  [{:keys [AGENTGATEWAY_MCP_ROUTER_URL MCP_ROUTER_URL]}]
  (let [pick (fn [s] (when (and (string? s) (seq (str/trim s))) (str/trim s)))]
    (-> (or (pick AGENTGATEWAY_MCP_ROUTER_URL)
            (pick MCP_ROUTER_URL)
            "https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message")
        (str/replace #"/+$" ""))))

(defn unwrap-mcp
  "MCP router の応答から、呼び手に返す値を取り出す。

  `{:result {:structuredContent X}}` → X、`{:result X}` → X、それ以外は素通し。
  `{:error …}` は呼び出し側が 502 にするので、ここでは判定だけ返す。"
  [payload]
  (cond
    (and (map? payload) (contains? payload :error))
    {:ok? false :error (get-in payload [:error :message] "MCP router returned an error")
     :upstream payload}

    (and (map? payload) (contains? payload :result))
    (let [r (:result payload)]
      {:ok? true :value (if (and (map? r) (contains? r :structuredContent))
                          (:structuredContent r)
                          r)})

    :else {:ok? true :value payload}))

;; ---------------------------------------------------------------------------
;; What the page is allowed to print as a VALUE.
;; ---------------------------------------------------------------------------

(def displayed-value-keys
  "ページが **値そのもの** を出す env キー。ここに無いキーは名前だけ出す。

  この集合を明示的に持つのは、`view` 側が『値は出さない』と書きながら実際には
  1 つ出していた、という欠陥が同型の移行で見つかっているから(README.md S6)。
  出すものを列挙しておけば、出していないことを検査できる。"
  #{:APP_DISPLAY_NAME :APP_DESCRIPTION :APP_NANOID})

(defn public-values
  "env → ページに出してよい値だけの map。"
  [env]
  (into {} (filter (fn [[k _]] (contains? displayed-value-keys k))) env))
