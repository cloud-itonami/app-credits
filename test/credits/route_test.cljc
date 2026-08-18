(ns credits.route-test
  (:require [clojure.test :refer [deftest is testing]]
            [clojure.string :as str]
            [credits.route :as route]
            [credits.view :as view]))

(deftest dispatch-page-and-health
  (doseq [app [route/credits-app route/wallet-app]]
    (testing (str (:app/name app))
      (is (= :page (:action (route/dispatch app "GET" "/"))))
      (is (= :health (:action (route/dispatch app "GET" "/health"))))
      (is (= :method-not-allowed (:action (route/dispatch app "POST" "/health"))))
      (is (= :not-found (:action (route/dispatch app "GET" "/nope")))))))

(deftest dispatch-xrpc-on-the-app-that-has-it
  (testing "単一セグメントの nsid"
    (is (= {:action :xrpc :nsid "com.etzhayyim.apps.credits.getBalance"}
           (route/dispatch route/wallet-app "POST" "/xrpc/com.etzhayyim.apps.credits.getBalance"))))
  (testing "空だけが 400。多段は移行前と同じく転送する（絞るのは方針変更）"
    (is (= :bad-request (:action (route/dispatch route/wallet-app "POST" "/xrpc/"))))
    (is (= {:action :xrpc :nsid "a/b"} (route/dispatch route/wallet-app "POST" "/xrpc/a/b"))))
  (testing "preflight と method"
    (is (= :cors-preflight (:action (route/dispatch route/wallet-app "OPTIONS" "/xrpc/x"))))
    (is (= :method-not-allowed (:action (route/dispatch route/wallet-app "GET" "/xrpc/x"))))))

(deftest xrpc-absent-on-the-app-that-never-had-it
  (testing "credits-mcp-component の deploy 面には XRPC が無い。
            405/400 ではなく 404 —— 『あるが今は使えない』に読ませない"
    (is (= :not-found (:action (route/dispatch route/credits-app "POST" "/xrpc/x"))))
    (is (= :not-found (:action (route/dispatch route/credits-app "OPTIONS" "/xrpc/x"))))
    (is (= :not-found (:action (route/dispatch route/credits-app "POST" "/xrpc/"))))))

(deftest mcp-url-resolution
  (is (= "https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message"
         (route/mcp-router-url {})))
  (is (= "https://a.example/x" (route/mcp-router-url {:AGENTGATEWAY_MCP_ROUTER_URL "https://a.example/x/"})))
  (testing "空白だけの設定は未設定として扱う"
    (is (= "https://b.example" (route/mcp-router-url {:AGENTGATEWAY_MCP_ROUTER_URL "   "
                                                     :MCP_ROUTER_URL "https://b.example"})))))

(deftest unwrap
  (is (= {:ok? true :value {:a 1}} (route/unwrap-mcp {:result {:structuredContent {:a 1}}})))
  (is (= {:ok? true :value {:a 1}} (route/unwrap-mcp {:result {:a 1}})))
  (is (false? (:ok? (route/unwrap-mcp {:error {:message "boom"}})))))

(deftest public-values-are-an-allow-list
  (testing "宣言したキーの値だけを通す。他は落とす"
    (is (= {:APP_DISPLAY_NAME "GCC Wallet" :APP_NANOID "wt1e2f3g"}
           (route/public-values {:APP_DISPLAY_NAME "GCC Wallet"
                                 :APP_NANOID "wt1e2f3g"
                                 :APP_UI_TYPE "SECRET"
                                 :AGENTGATEWAY_MCP_ROUTER_URL "https://r.example"})))))

(deftest page-shows-the-real-routes-not-a-baked-count
  (testing "ページは route 表から描く。0 を焼かない（docs/adr/0001 の欠陥）"
    (doseq [app [route/credits-app route/wallet-app]]
      (let [routes (:app/routes app)
            html (view/render {:css "/*x*/"
                               :display-name "Test App"
                               :description "desc"
                               :nanoid "n4n01d"
                               :routes routes
                               :vars [:APP_NANOID :APP_UI_TYPE]
                               :relay-url (when (:app/xrpc? app) "https://mcp.example/x")})]
        (doseq [r routes]
          (is (str/includes? html (:route/path r))
              (str (:app/name app) ": " (:route/path r) " がページに出ていない")))
        (testing "件数は route 表から導出される"
          (is (str/includes? html (str "公開ルート " (count routes) " 本"))))
        (is (str/includes? html "APP_NANOID"))
        (is (str/includes? html "Test App"))
        (when (:app/xrpc? app)
          (is (str/includes? html "https://mcp.example/x")))))))

(deftest the-two-apps-do-not-share-a-route-table
  (testing "wallet だけが XRPC を持つ。片方の表をもう片方に使っていない"
    (is (some #(= "/xrpc/:nsid" (:route/path %)) (:app/routes route/wallet-app)))
    (is (not-any? #(= "/xrpc/:nsid" (:route/path %)) (:app/routes route/credits-app)))
    (is (= 3 (count (:app/routes route/wallet-app))))
    (is (= 2 (count (:app/routes route/credits-app))))))
