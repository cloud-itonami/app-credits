(ns credits.view
  "appview の説明ページ。純 hiccup。

  基盤は `jp-go-dds`(デジタル庁デザインシステム) —— superproject の
  skill `kotoba-uiux` が定める新規 UI の base。色・寸法は `--hig-*` トークン
  契約で書き、raw hex も px フォントサイズも置かない。

  **表示する事実は引数で受け取る。ページの中に焼かない。**
  これは装飾の都合ではなく、docs/adr/0001 が記録した欠陥そのものへの答えで
  ある —— 移行前の wallet のページは

      \"routeCount\": 0, \"routes\": [], \"vars\": []

  を literal で持っていて、隣の wrangler.jsonc が route 1 本と var 8 個を
  宣言していることに気づけなかった。ここでは route 表と env を渡す側が持ち、
  ページは描くだけなので、両者がずれる余地が無い。件数も `(count routes)` で
  導出する —— 数を手で書けば、それはまた焼いた定数になる。"
  (:require [jp-go-dds.core :as dds]
            [jp-go-dds.page :as page]
            [jp-go-dds.tokens :as tokens]
            [clojure.string :as str]))

(def app-css
  "app 固有の最小 CSS。`--hig-*` 契約だけを使う(bridge が DADS の上に再定義する)。
  DADS を base にした app の下には `shitsuke.hig` が居ないので、bridge が運んで
  いないトークンは何にも解決しない —— 使うのは運ばれている 74 個の中だけ。"
  (str/join
   "\n"
   [".cr-lede { color: var(--hig-color-secondary-label); max-width: 42rem; }"
    ".cr-note { color: var(--hig-color-secondary-label); font-size: var(--hig-text-footnote-font-size); }"
    ".cr-mono { font-family: var(--hig-font-mono); }"]))

(defn- route-rows [routes]
  (mapv (fn [r]
          [(str/upper-case (name (:route/method r)))
           [:span {:class "cr-mono"} (:route/path r)]
           (:route/doc r)])
        routes))

(defn body
  "opts:
   :display-name  APP_DISPLAY_NAME の **値**（見出しになる）
   :description   APP_DESCRIPTION の **値**
   :nanoid        APP_NANOID の **値**
   :routes        credits.route の route 表（この Worker が実際に答えるもの）
   :vars          env のキー（**キー名だけ**）
   :relay-url     XRPC の中継先。XRPC を持たない app では nil
   :built-at      bundle のビルド時刻（不明なら nil）

  見出しも説明も引数である。ページ側に literal を持たないので、wrangler.jsonc
  の vars を変えれば表示も変わる —— 逆に言えば、表示が古いなら設定が古い。"
  [{:keys [display-name description nanoid routes vars relay-url built-at]}]
  (dds/container
   (dds/section
    {}
    (dds/heading 1 (or display-name "(APP_DISPLAY_NAME が env に無い)"))
    (when description [:p {:class "cr-lede"} description])
    (when nanoid
      [:p {:class "cr-note"} "nanoid: " [:span {:class "cr-mono"} nanoid]]))

   (dds/section
    {:title "この面が答えるもの"}
    (dds/table {:caption (str "公開ルート " (count routes) " 本")
                :headers ["METHOD" "PATH" "何をするか"]
                :rows (route-rows routes)})
    [:p {:class "cr-note"}
     "この表も件数も Worker の route 表そのものから描いている。ページに焼いた"
     "値ではないので、実際に答えるものと表示がずれない。"])

   (dds/section
    {:title "実行時の設定"}
    (if (seq vars)
      [:div
       (into [:p] (interpose " " (map (fn [k] (dds/chip-label (name k))) vars)))
       [:p {:class "cr-note"}
        "上は **キー名のみ**。値を出しているのは見出し(APP_DISPLAY_NAME)・"
        "説明(APP_DESCRIPTION)・nanoid(APP_NANOID)"
        (when relay-url "、および下の中継先")
        "だけで、それ以外の値はこのページに出ない。"]]
      [:p {:class "cr-note"} "env が渡されていない（ローカル描画）。"])
    (when relay-url
      [:p {:class "cr-note"} "XRPC の中継先: "
       [:span {:class "cr-mono"} relay-url]
       " —— どこへ中継するかは運用者が見る必要があるので意図的に値を出している。"]))

   (dds/section
    {:title "現在地"}
    [:p {:class "cr-lede"}
     "この appview は TypeScript/Svelte から ClojureScript へ移行済み。"
     "deploy される bundle は、いま読んでいるソースからコンパイルされたもので"
     "ある（docs/adr/0001）。"]
    [:p {:class "cr-note"}
     "ただし **この Worker はまだ deploy できない** —— route が指すホストが "
     "DNS に無い。詳細と実測は README.md と docs/operator-quickstart.md。"]
    (when built-at
      [:p {:class "cr-note"} "bundle build: " built-at]))))

(defn render
  "完全な HTML 文書。`css` は呼び出し側が渡す(ライブラリは I/O を持たない)。"
  [{:keys [css display-name description] :as opts}]
  (page/->page
   {:title (or display-name "app-credits appview")
    :description (or description "app-credits の appview 公開面。")
    :lang "ja"
    :css css
    :app-css (str tokens/bridge-css "\n" app-css)}
   (body opts)))
