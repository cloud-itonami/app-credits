# Base トークン設計（BOT / KUMO / YATA）

**正本の決定**: ADR-2608311800（発行チェーンと contract）+ ADR-2608291009（3 単位の型と膜規則）
**対象チェーン**: Base — CAIP-2 `eip155:8453`
**トレジャリー**: Safe `eth:0xA00366234D29d4F882088048c0B2fa0dB7302D4E`（Base / Ethereum とも同一アドレス）

---

## 0. この文書は前版（`TOKEN_DESIGN_ETHEREUM.md`）の何を撤回したか

前版は 2 つの前提を置いていた。どちらも撤回する。

| 前版 | 現行 | 根拠 |
|---|---|---|
| 対象チェーンは Ethereum Mainnet | **Base（eip155:8453）** | ADR-2608311800 D1 |
| `GCC` という 1 つの ERC-20 が計算クレジットを兼ね、DEX で売買される | **3 つの別の型。on-chain に出るのは BOT だけ** | ADR-2608291009 D1 / ADR-2608311800 D2 |
| contract に Circle 実装を使う理由は監査コスト最小化 | **理由は EIP-3009。sink (a) が要求する wire である** | ADR-2608311800 D4 |
| Phase 3 で「L2 展開（Arbitrum/Base）」 | **Base が出発点。L2 展開は将来の分岐ではない** | 同 D1 |
| Safe 運用は「マルチシグ閾値（例: 2/3, 3/5）」 | **実測すると Base は 1-of-1。発行前の第一ブロッカー** | 同 D7 |

### 一番大きな訂正 —— `GCC` の形そのものが 3 単位設計と衝突していた

前版の `GCC` は **計算クレジットでありながら Uniswap で売買される ERC-20** だった。
これは ADR-2608291009 が構造的に禁じている形である。

演算の対価は **KUMO**（労圏）であり、労圏の単位は償還不能でなければならない。
ERC-20 にして DEX に載せた瞬間に外部価格が付き、**償還不能性が実効的に失効する** ——
市場で売れるなら、それは償還できるのと同じである。

したがって前版の `GCC` は 2 つに分かれる:

- **交換可能な token としての面** → `BOT`（準圏。外部市場で売買可、発行体は買い戻さない）
- **計算クレジットとしての面** → `KUMO`（労圏。台帳内の単位。contract を持たない）

### `GCC` は既に Ethereum mainnet に生きている（実測 2026-08-31）

前版を読むときに一番間違えやすいのがここなので、先に測った値を置く。

```
GCC  0x799d24a6FFBb758C6E2Ed8f981822A17Eaa5F30B   (Ethereum mainnet)
  name          Gftd Computing Credits
  symbol        GCC
  decimals      6
  totalSupply   10,000,006.711595 GCC
  version()     2          -> Circle FiatToken V2 の直接デプロイ
  proxy slot    EIP-1967 / zeppelinos とも 0 -> upgradeable ではない
  owner / masterMinter / blacklister  = 0xA003…D4E（junbi Safe）
  EIP-3009 (authorizationState)  応答する
  EIP-2612 (nonces)              応答する
  Safe の保有                     10,000,000.000000 GCC（供給の 99.99993%）
  Uniswap v3 プール (GCC/USDC, fee 500 / 3000 / 10000)  いずれも存在しない
  Base 上のコード                 0 バイト
```

つまり GCC は **deploy 済みで、mint 済みで、上場されていない**。
供給はほぼ全量が treasury Safe にあり、市場は 1 つも作られていない。

このことは本設計の contract 選択（§3）を**否定せず、裏付ける** ——
mainnet GCC は既に Circle FiatToken であり、EIP-3009 と EIP-2612 を持っている。
`evm/contracts/GCCStablecoin.sol` は**その deploy には使われていない**（`supplyCap()` が
revert し、`version()` が 2 を返す）。

引き継がないのは **GCC という単位の役割**であって、contract の実装系ではない。
GCC は計算クレジットでありながら DEX で売買される前提を持っており、その形が
3 単位設計と衝突する（上記）。既存の GCC をどう扱うかは未決（§11）。

---

## 1. 目的

営み bot が働いて得た **収入** を裏付けに `BOT` を発行し、Base 上で購入・swap 可能にする。
`KUMO`（演算）と `YATA`（保管）は台帳内の計量単位として、その経済圏の消費側を担う。

---

## 2. 3 つの単位 —— on-chain に出るのは BOT だけ

| | **KUMO** | **YATA** | **BOT** |
|---|---|---|---|
| 何 | 演算の計量単位 | 保管の計量単位 | **交換可能 token** |
| 圏 | 労圏 | 労圏 | **準圏（junbi）** |
| 単位 | memory×time / Mtok / 秒 | **GB-month**（+ egress GB は別単位） | 個 |
| 裏付け | 実測された演算の供給 | 耐久性チャレンジに通った GB-month | **外部で実際に決済された収入** |
| **contract** | **無し** | **無し** | **ERC-20 on Base** |
| 保有者間移転 | 可（台帳内） | 可（台帳内） | 可（on-chain） |
| fiat / USDC へ償還 | **不可** | **不可** | 外部市場でのみ売れる。発行体は買い戻さない |
| 外部市場での取引 | **不可** | **不可** | **可**（唯一の投機面） |
| 相互交換 | **KUMO ↮ YATA は禁止** | 同左 | BOT → KUMO / YATA は可、逆は禁止 |

**KUMO ↔ YATA を直接交換できないことが設計の要である。** 通せば内部為替が生まれ、
レートの oracle が要り、裁定の対象になる。変換したければ「片方を売る」のではなく
**junbi から別々に買う**。

### 膜の通過規則（ここに無い流れは実装しない）

```
準圏 junbi   USDC / fiat / BOT（交換可能・外部市場・唯一の投機面）
     │ mint（一方向）
     ▼
労圏 labour  KUMO（演算）  YATA（保管）  ← どちらも償還不可
             KUMO ↮ YATA 禁止
縁圏 EN      非価格・非発行・非交換。一切触らない
```

| 流れ | 可否 |
|---|---|
| fiat / USDC → KUMO / YATA | 可（一方向 mint） |
| KUMO / YATA → fiat / USDC | **禁止** |
| KUMO ↔ YATA | **双方向とも禁止** |
| BOT → KUMO / YATA | 可（一方向） |
| KUMO / YATA → BOT | **禁止** |
| BOT ↔ USDC / fiat（外部市場） | 可 |
| x402 を BOT で払う | 可。受領した BOT は **burn** |

**BOT → KUMO / YATA は 2 段で実装する**: on-chain の BOT burn と、台帳への credit。
逆向きの経路は実装しない。

---

## 3. BOT の contract —— 決め手は EIP-3009 であって監査コストではない

sink (a)（x402 を BOT で払うと割引、受領分は burn）は、3 つの sink のうち唯一
**決済需要に直結する**。そして x402 の canonical EVM scheme は `exact` で、その payload は
**EIP-3009 の `transferWithAuthorization`** を運ぶ（`nexus-x402` の `pay/x402.cljc` が
`:assetTransferMethod "eip3009"` を書いている）。

```
sink (a) を成立させたい
  → x402 の exact で BOT を払えなければならない
    → token が EIP-3009 を実装していなければならない
      → GCCStablecoin.sol は実装していない（18 関数のいずれも該当なし）
      → Circle の FiatTokenV2_2 は実装している（EIP3009.sol を継承）
```

**したがって contract は経済設計から一意に決まる。**

| 項目 | 決定 |
|---|---|
| 実装 | `evm/third_party/usdc` の **`FiatTokenV2_2` + `FiatTokenProxy`**（vendored 済み、verbatim） |
| decimals | **18**（USDC の 6 に合わせない。掲示価格に対する丸め粒度を細かく保つ） |
| owner / pauser / blacklister / masterMinter | Safe |
| mint | Safe が `configureMinter` を実行し、許容量内で minter が発行 |
| blocklist | **残す**。使わない権限を Safe に置くコストは低く、後から足すには upgrade が要る。ただし操作は on-chain 記録 + 監査ログ公開 |
| `evm_version` | **`prague` を foundry.toml に明示 pin する**（§3.1） |

### 3.1 evm_version は道具の既定に委ねない

Base は実測で **Prague** まで有効（latest block が Cancun の blob 系フィールドに加えて
`requestsHash` を持つ）。forge 1.7.1 の既定も `prague` なので値は変わらないが、
**既定は道具のバージョンで動く**ので明示的に書く。

同じ workspace に前例が両方ある:

- `gftdcojp/apps-gftdcojp/.../geth-private/contracts/foundry.toml` は `evm_version = "paris"` を
  pin し、理由（genesis が `shanghaiTime` を持たず PUSH0 を拒否する）をコメントに書いている。
  **これが正しい形**
- `kotoba-lang/kotobase-anchor-fevm/foundry.toml` は pin を持たない。Filecoin Calibration profile を
  配りながら実効値は `prague` で、一度も実 deploy されていないので Calibration で通るかは未測定

---

## 4. 発行・償却

### 4.1 BOT は「労働裏付け」ではなく「収入裏付け」

**`bot` が働いたことでは発行されない。** mint するのは:

- 外部が実際に決済した収入
- finalize された witness duty

`KUMO` / `YATA` は従来どおり労働裏付け・pre-mine 無し。`YATA` は「置いた」ではなく
**「置き続けていることを耐久性チャレンジで証明した」** が発行条件。

### 4.2 供給

初期総供給の固定上限は置かない —— 収入裏付け発行なので、供給は実現収入の関数である。
配分表（エコシステム / トレジャリー / コミュニティ / チーム）は**前版の数字を引き継がない**。
掲示価格の決め方（ADR-2608291009 D6 の 4 手順）が先で、それまでは未測定とする。

### 4.3 burn

- x402 の BOT 払いで受領した分（sink (a)）
- `BOT → KUMO / YATA` の変換で焼かれた分

**価値上昇を目的としたデフレ設計はしない。**

---

## 5. 購入・swap 導線（Base）

- **DEX**: Uniswap v3 factory は Base に live（`feeAmountTickSpacing(3000)` が 60 を返す）。
  初手は `BOT/USDC` 1 本。`BOT/WETH` は流動性が付いてから
- **決済資産**: USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`（symbol=USDC / decimals=6、実測）
- **アプリ内導線**: Wallet 接続 / `Buy BOT`（USDC → BOT）/ 価格表示（DEX TWAP + oracle 補助）。
  請求は USD 建て表示 + 実決済 BOT 換算

---

## 6. Safe 運用 —— 実測すると Base は 1-of-1

```
Safe 0xA00366234D29d4F882088048c0B2fa0dB7302D4E
  Ethereum mainnet   threshold = 2 / owners = 3
  Base               threshold = 1 / owners = 1   ← 単一 EOA
  Base USDC 残高     10.21 USDC
```

**x402 の quote は `network=base` なので、収益が実際に入るのは弱い方である。**
BOT の treasury をここに置くなら、これが発行前の第一ブロッカー（§10-1）。

---

## 7. sink

| | sink | 型 | 実装点 |
|---|---|---|---|
| (a) | x402 を BOT で払うと割引、受領分は burn | Render BME | `nexus-x402` の asset 固定を外す（§7.1） |
| (b) | witness bond を USDC → BOT | Livepeer LPT | ADR-2607994000 の bond の建値差し替え。最も小さい |
| (c) | treasury release governance を stake 加重 | 一般 | 既存機構の拡張 |
| (d) | bot enrolment bond（governed fleet への入場に BOT bond、governor 違反で slash） | 一般 | 未設計 |

### 7.1 sink (a) の実装点

`pay/x402.cljc` の `usdc-base` は定数で、`v2-payment-requirements` の `:asset` 既定がそこを指す。
requirement は既に**複数 asset を配列で返せる形**を持つので、必要な変更は:

1. asset を network ごとの index から引く。⚠ **未知チェーンで黙って Base に fallback する罠**を
   再現しないこと（ADR-2608010930 が testnet 側で踏んだもの）
2. BOT 建て requirement を USDC 建てと並べて返す。割引は価格側で表現する
3. 受領した BOT を burn する経路を settlement 後に置く

**1 と 2 の形だけは BOT が存在しなくても先に用意できる。** ただし settlements が 0 の間は
本番決済面の requirement 形状を変えない —— 原因の切り分けが 1 つ増えるため。

---

## 8. 段階

| Phase | 内容 |
|---|---|
| 0（現在） | 設計のみ。contract 無し・配布無し・上場無し。§10 の 5 件が開いている |
| 1 | Base に `BOT` を deploy、`BOT/USDC` に小規模 LP、sink (a) をβで通す |
| 2 | sink (b)(c)(d)、worker 報酬のオンチェーン分配、可視化ダッシュボード |
| 3 | 手数料設計の最適化、他チェーンへの橋（**Base が出発点であり、Base への展開は Phase 3 ではない**） |

---

## 9. KPI

- 日次 BOT 出来高（DEX） / BOT 保有アドレス数
- **x402 の BOT 払い比率**（sink (a) が効いているか。ここが決済需要の直接指標）
- burn 量 / mint 量（収入裏付けの実効レート）
- BOT → KUMO / YATA の変換量
- mint 実行回数・量（期間 cap 内遵守率） / pause 復旧時間 / blocklist 運用件数

**「BOT 価格」を KPI にしない。**

---

## 10. 発行前に塞ぐ 5 件（Base に決めても 1 件も減らない）

| # | 塞ぐもの | 現在地（実測 2026-08-31） | 誰の領域 |
|---|---|---|---|
| 1 | Base Safe が 1-of-1 | threshold=1 / owner 1 名の EOA | owner |
| 2 | settlements が 0 | kotobase: challenges 23 / submissions 4 / settlements 0 | agent + owner |
| 3 | HAKARI の 40% が読めない | junbi の basket weights の `jpyc` 0.40 に対し `token-registry` の `:address` が nil | Council 承認 |
| 4 | `terms.md` の MCC 記述 | 未発行の token を live の法務文書が現在形で transferable utility token と記述 | owner + 弁護士 |
| 5 | 発行体 ≠ 運営者 | サービス運営も chain 資産保管も AWAI Network, L.L.C.（ADR-2607320500 §1） | owner + 弁護士 |

**チェーンの決定は順序の決定ではない。** ADR-2607299900 Decision 5 のとおり、
token は capital を連れてくるが settlement demand は連れてこない。

---

## 11. この文書が引き継がなかったもの

- **`GCC` という単位の役割** —— §0 のとおり形が 3 単位設計と衝突する。
  **ただし GCC contract 自体は mainnet に生きており、供給 10,000,006.7 のうち
  10,000,000 を junbi Safe が保有している。** これをどう扱うかは owner 判断であり、
  本文書は決めない（下記 open question）
- **`evm/contracts/GCCStablecoin.sol`** —— この repo に残るが **BOT の候補ではない**
  （EIP-3009 も EIP-2612 も持たないため sink (a) が成立しない）。mainnet の GCC は
  このファイルからは deploy されていない。private geth（chainId 260425）と anvil（1337）
  への deploy は 2026-04 の成果物
- **固定初期供給と配分比率** —— 収入裏付け発行と両立しないため §4.2 で保留
- **Ethereum Mainnet の Uniswap v3 集中流動性設計** —— L1 は Base から橋を架ける形で後から

---

## 12. 未決（owner 判断）

1. **mainnet の GCC（供給 10,000,006.7、うち Safe が 10,000,000）をどうするか。**
   選択肢は少なくとも 3 つ: (a) 放置し BOT を Base に別途出す (b) GCC を退役させる
   （burn 権限は Safe にある）(c) GCC を BOT の前身として位置づけ直す。
   **どれを採っても、GCC が upgradeable でない以上 Base へは移せない**（同一 contract の
   移転は不可能で、新規 deploy + 配布になる）
2. blocklist を BOT に残すか（§3 は残す判断だが agent の推奨であってオーナー確認前）
3. BOT の ticker を `BOT` のままにするか
4. upgrade 可能にするか。**mainnet GCC は非 upgradeable を選んでいる**ので、
   `FiatTokenProxy` を採ると先例と逆になる
5. Uniswap v3 を採るか、Base のネイティブ DEX を採るか
