#!/usr/bin/env nbb
;; render-page — ビルド済み bundle の `GET /` を 1 枚の HTML に落とす。
;;
;; design-quality の採点(docs/operator-quickstart.md S6)に食わせるための出力で
;; あって、それ以外の用途は無い。**ページを別経路で組み直さない** —— 採点する
;; のは deploy される bundle が実際に返す HTML でなければ意味が無いので、
;; ここは worker を呼ぶだけにしてある。
;;
;; Usage:  nbb scripts/render-page.cljs <bundle.js> <out.html> [<app>]
;;         <app> は "wallet"(既定) か "credits"。env の見本を切り替えるだけ。
;; Exit:   0 書けた · 2 bundle が無い/呼べない

(require '["node:fs" :as fs] '["node:path" :as path] '["node:url" :as url]
         '[kotoba.lang.text :as str])

(def args (vec (remove #(str/starts-with? % "--") *command-line-args*)))
(def bundle (get args 0))
(def out (get args 1))
(def app (get args 2 "wallet"))

(when (or (nil? bundle) (nil? out))
  (println "UNDETERMINED\tusage: nbb scripts/render-page.cljs <bundle.js> <out.html> [wallet|credits]")
  (js/process.exit 2))

(def envs
  {"wallet" #js {"APP_DISPLAY_NAME" "GCC Wallet"
                 "APP_DESCRIPTION" "GCC Wallet — thin edge facade for BPMN credit ledger operations"
                 "APP_NANOID" "wt1e2f3g"
                 "APP_PERFORMER_TYPE" "person"
                 "APP_UI_TYPE" "yoro"
                 "APP_CAPABILITIES" "[\"bpmn-dispatch\",\"credit-ledger\",\"reward-management\"]"
                 "APP_FRAMEWORK" "cljs-esm-worker"
                 "AGENTGATEWAY_MCP_ROUTER_URL" "https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message"}
   "credits" #js {"APP_DISPLAY_NAME" "Credits Mcp"
                  "APP_DESCRIPTION" "Credits Mcp — AI Agent"
                  "APP_NANOID" "a5ce95af"
                  "APP_PERFORMER_TYPE" "service"
                  "APP_UI_TYPE" "appview"
                  "APP_CAPABILITIES" "[\"bpmn-dispatch\",\"credit-ledger\",\"reward-management\"]"
                  "APP_FRAMEWORK" "cljs-esm-worker"
                  "APP_EMBED_URL" "https://a5ce95af.etzhayyim.com/?embed=1"
                  "AGENTGATEWAY_MCP_ROUTER_URL" "https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message"}})

(when-not (.existsSync fs (.resolve path bundle))
  (println (str "UNDETERMINED\tno bundle at " bundle))
  (js/process.exit 2))

(-> (js/import (.-href (.pathToFileURL url (.resolve path bundle))))
    (.then (fn [m]
             (let [h (.-default m)
                   env (get envs app (get envs "wallet"))]
               (-> (js/Promise.resolve ((.-fetch h) (js/Request. "https://credits.etzhayyim.com/") env #js {}))
                   (.then (fn [r] (.text r)))
                   (.then (fn [t]
                            (.writeFileSync fs out t)
                            (println (str "OK\twrote " out " (" (count t) " bytes) from " bundle " as " app))))))))
    (.catch (fn [e]
              (println (str "UNDETERMINED\tcould not render: " (.-message e)))
              (js/process.exit 2))))
