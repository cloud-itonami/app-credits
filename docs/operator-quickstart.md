# app-credits — operator quickstart

**Nothing in this repository deploys as-is, and the credit model it describes has
been superseded.** That is still the first thing an operator needs. What changed
on 2026-08-18 is that the two Workers are now ClojureScript compiled from source
you can read, instead of pointing at a SvelteKit artifact that is committed
nowhere (`docs/adr/0001`).

Everything below was walked on **2026-08-18** against this branch. Commands are
given so you can re-walk them rather than trust this page. `nbb
scripts/verify-docs-claims.cljs .` re-derives the numbers and fails if they drift.

---

## 1. What is actually here

```bash
git ls-files | wc -l                                   # 81
git ls-files | awk -F/ 'NF>1{print $1"/"} NF==1{print $1}' | sort | uniq -c | sort -rn
```

| Path | Files | What it is |
|---|---:|---|
| `evm/` | 45 | 1 own contract (`contracts/GCCStablecoin.sol`) + Circle's USDC vendored verbatim + 1 runbook |
| top level | 12 | `README.md`, `CLAUDE.md`, `TOKEN_DESIGN_BASE.md`, `deps.edn`, `shadow-cljs.edn`, … |
| `kotoba/` | 7 | a standalone TypeScript credits library — 594 lines + 153 of test (§4) |
| `appview/` | 6 | two Worker configs + descriptors + READMEs (§3) |
| `src/` | 5 | **the two Workers in ClojureScript** |
| `scripts/` | 3 | the render helper and two gates |
| `docs/` | 2 | the ADR and this page |
| `test/` | 1 | the route/view test suite |

`evm/third_party/usdc/` is upstream code this repository does not own
(`UPSTREAM.md`: circlefin/stablecoin-evm at `f2f8b3bb`, no local edits).

## 2. Where the live successor is

The successor is **`orgs/cloud-itonami/credits`** — the ENGI mutual-credit
kernel, whose README states it *"replaces the centrally issued GCC/credit
model"*. `CLAUDE.md` here is the **legacy** design (30 % purchase fee, admin
minter, Safe treasury), not the target one.

```bash
gh api repos/etzhayyim/com-etzhayyim-credits --jq .full_name   # -> cloud-itonami/credits
```

## 3. The two Workers

Both are ClojureScript. Each `wrangler.jsonc`'s `main` points at the bundle
compiled from `src/`:

```bash
for w in appview/credits-mcp-component appview/etzhayyim-wasm-wallet-wt1e2f3g; do
  sed 's|^[[:space:]]*//.*$||' "$w/wrangler.jsonc" \
  | python3 -c 'import json,sys; j=json.load(sys.stdin); print(j["main"], len(j["vars"]), len(j["routes"]))'
done
# ../../dist/credits/worker.js 9 2
# ../../dist/wallet/worker.js  8 1
```

| | `GET /` | `GET /health` | `POST /xrpc/:nsid` | `OPTIONS /xrpc/*` |
|---|---|---|---|---|
| `credits-mcp-component` | page | JSON | 404 — never had it | 404 |
| `etzhayyim-wasm-wallet-wt1e2f3g` | page | JSON | relay to MCP router | 204 |

Every hostname these Workers route to or call still resolves to nothing:

```bash
for h in credits.etzhayyim.com a5ce95af.etzhayyim.com wt1e2f3g.etzhayyim.com \
         mcp.etzhayyim.com dispatcher.etzhayyim.com etzhayyim.com; do
  printf '%-30s %s\n' "$h" "$(dig +short $h A | tr '\n' ' ')"
done
```

Measured 2026-08-18: the first five return nothing; `etzhayyim.com` returns
`104.21.51.111 172.67.179.128`. The zone is alive; these names are not in it.
**Do not deploy** — a deploy publishes a proxy to nowhere.

## 4. `kotoba/` — not part of the migration

594 lines of TypeScript implementing the *c-split* credits model, with 8 vitest
tests. It is imported by neither appview, is in no bundle here, and its one
production dependency is **type-only** (`kotoba/src/registry.ts:17`). It was
**not** touched by the ClojureScript migration:

```bash
git diff bb4f922 -- kotoba evm      # empty — byte-identical to before the migration
```

`scripts/verify-docs-claims.cljs` pins its file count in both directions, so it
cannot grow or shrink unnoticed. The declared npm install still fails on
npm ≥ 11.16 (`EALLOWSCRIPTS`, because `@etzhayyim/sdk` has a `prepare: tsc`
script); the workaround that runs the suite is unchanged and is recorded in this
file's history (`git log -p docs/operator-quickstart.md`). **That suite was not
re-run for this migration** — nothing in `kotoba/` changed.

## 5. Build the Workers

Builds go through the workspace resource guard, which serializes them across all
agent sessions. **Exit 2 means queued, not failed** — retry, do not treat it as
an error.

```bash
for i in $(seq 1 60); do
  node /Users/junkawasaki/github/com-junkawasaki/scripts/resource-guard.mjs run build \
    -- npx --yes amu compile --target wasm32-browser credits-worker wallet-worker && break
  [ $? -eq 2 ] || break
  sleep 20
done
```

Real output (2026-08-18, after 8 queued attempts):

```
[:credits-worker] Build completed. (56 files, 13 compiled, 0 warnings, 7.82s)
[:wallet-worker] Build completed. (56 files, 13 compiled, 0 warnings, 4.09s)
```

`:warnings-as-errors true` sits under `:compiler-options` in `shadow-cljs.edn`.
That placement is load-bearing: shadow reads
`[:compiler-options :warnings-as-errors]`, so the same key under
`:build-options` is **silently ignored** — a fix that cannot fail. See §9 for
the demonstration, and note that `scripts/verify-docs-claims.cljs` reads the key
**by EDN path**, not by grep (a grep would be satisfied by the comment above it).

## 6. Gates

```bash
K=/Users/junkawasaki/github/com-junkawasaki/orgs/kotoba-lang
G=~/.gitlibs/libs/io.github.kotoba-lang/jp-go-digital-design-system/2e2d191e9e1731ce6865c79dab163a5d74249053
CP="src:test:$G/src:$G/resources:$K/html/src:$K/css/src"

# 1. tests (pure decisions; no browser, no build, no network)
npx --yes kbb --backend sci --classpath "$CP" \
  -e "(require '[cljs.test :refer [run-tests]] 'credits.route-test) (run-tests 'credits.route-test)"
#   Ran 8 tests containing 39 assertions.
#   0 failures, 0 errors.

# 2. the page, scored — rendered FROM THE BUILT BUNDLE, not rebuilt separately
npx --yes kbb --backend sci scripts/render-page.cljk dist/wallet/worker.js /tmp/page.html wallet
cd $K/design-quality && npx --yes kbb --backend sci -m design-quality.cli score /tmp/page.html --min 95 --extra-axes
#   100.00   aggregate: 100.00
#   axes scored: 12 (…, input-zoom, contrast)
#   gate: aggregate 100.00 >= min 95.00 -> PASS

# 3. smoke — imports the BUILT bundles and exercises both
npx --yes kbb --backend sci scripts/smoke-worker.cljk .
#   OK  both built bundles answer as their route tables say   (39 checks)

# 4. docs — every number on this page and in README.md, re-derived
npx --yes kbb --backend sci scripts/verify-docs-claims.cljk .
#   OK  every claim in README.md and docs/operator-quickstart.md holds  (31 claims)
```

**Read what the design-quality line says about itself.** Without `--extra-axes`
it applies 10 of 12 axes and prints *"A pass says nothing about an axis that was
not applied."* A 100.00 there is much weaker than it looks — measured elsewhere,
a page with no design system at all scores 96.63 and passes `--min 95`. The
smoke script therefore checks the design system separately, and in **two** parts
(§9, mutation 3).

## 7. Run them locally, and why there are no `nodejs_*` flags

`nodejs_compat` / `nodejs_als` were adapter-cloudflare's requirement. The cljs
bundles import no node builtin:

```bash
for b in dist/credits/worker.js dist/wallet/worker.js; do
  printf '%-28s node:=%s require(=%s process.=%s Buffer=%s\n' "$b" \
    "$(grep -c 'node:' $b)" "$(grep -c 'require(' $b)" \
    "$(grep -c 'process\.' $b)" "$(grep -c '\bBuffer\b' $b)"
done
# both -> node:=0 require(=0 process.=0 Buffer=0
```

That is a static argument, so it was also **run**, with the flags removed:

```bash
cd appview/etzhayyim-wasm-wallet-wt1e2f3g
npx --yes wrangler@latest dev --local --port 8799
```

```
[wrangler:info] Ready on http://localhost:8799
GET      /              -> 200
GET      /health        -> 200
POST     /xrpc/         -> 400
OPTIONS  /xrpc/x        -> 204
GET      /nope          -> 404
POST     /health        -> 405

$ curl -s localhost:8799/health
{"ok":true,"app":"etzhayyim-wasm-wallet-wt1e2f3g","runtime":"cljs","routes":["/","/health","/xrpc/:nsid"]}

$ curl -s -X POST -d '{"user_id":"u1"}' localhost:8799/xrpc/com.etzhayyim.apps.credits.getBalance
status=502
{"error":"MCP router unreachable","url":"https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message"}

$ curl -s -o /dev/null -w '%{http_code}' -X POST -d '{}' localhost:8799/xrpc/a/b
502        # relayed, not rejected — SvelteKit's [...path] did the same
```

And the credits Worker on port 8798:

```
GET / -> 200   GET /health -> 200   POST /xrpc/ -> 404
OPTIONS /xrpc/x -> 404   GET /nope -> 404   POST /health -> 405
{"ok":true,"app":"credits-mcp-component","runtime":"cljs","routes":["/","/health"]}
```

Both start and answer every route with the flags removed. That is the evidence
for dropping them.

The 502 is the point: with the upstream unreachable the relay **fails loudly**
rather than returning an empty 200.

## 8. If you have been asked to change something here

1. **New value flows go to `orgs/cloud-itonami/credits`** (ENGI), not here.
2. **Do not deploy either Worker** without first restoring the five DNS names
   and the MCP upstream.
3. `kotoba/` is a separate package with its own suite — run it before and after
   any change to it, and note that this migration did not touch it.
4. Reconciliation of existing GCC touches on-chain state controlled by the Safe
   at `0xA003…2D4E` — a treasury operation with a runbook
   (`evm/docs/SAFE_ISSUANCE_RUNBOOK.md`), not a code change here.

## 9. Every gate was shown to fail

Green is worth nothing on its own. Each gate was broken on purpose, the right
check was watched going red, and the break was reverted. **One mutation at a
time** — two at once can mask each other.

| # | Mutation | What went red | What stayed green |
|---|---|---|---|
| 1 | `credits-app` given `:app/xrpc? true` and the xrpc route | `xrpc-absent-on-the-app-that-never-had-it` (3 assertions) and `the-two-apps-do-not-share-a-route-table` (2) — **5 failures / 41 assertions** | the other 6 tests |
| 2 | `kotoba/src/types.ts` deleted | `kotoba-files` 7→6, `kotoba-ts-files` 5→4, `tracked-files` 81→80 | `kotoba-entrypoint-present` |
| 3 | `(rc/inline "jp_go_dds/dds.css")` → `""` | `page carries the stylesheet itself`, both apps | `page uses the design system components`, both apps — **the split is the point** |
| 4 | `:vars (sort (keys m))` → `(sort (vals m))` (values rendered where keys were meant) | `page hides other var values`, both apps; **and** `credits page shows no relay target` | `page shows the value it says it shows`, both apps |
| 5a | heading changed from `(or display-name …)` to the literal `"Credits"` | **nothing — the check stayed green.** Mis-aimed, see below | — |
| 5b | same mutation, after the check was fixed | `page shows the value in the heading it renders`, both apps | `page shows the value it says it shows` |
| 6 | undeclared var `route/credits-app-TYPO` in `mcp_worker.cljs` | the **build** — `rc=1`, `{:warning :undeclared-var … :shadow.build.compiler/warning-as-error true}`, and no bundle written | — |
| 7 | same var, with `:warnings-as-errors` moved to `:build-options` | **nothing — `rc=0`, `Build completed. (56 files, 1 compiled, 1 warnings)`, and a bundle was written** | — that is the defect |

### Mutation 5 did not fail, and that was a real finding

The heading was replaced by a baked constant — the *exact* defect this migration
exists to remove — and `page shows the value it says it shows` **stayed green**.
The bundle was genuinely rebuilt (hash changed, `<h1 …>Credits</h1>` present in
the output), so this was not a stale artifact. The check was simply too weak:
`view/render` puts `display-name` in the `<title>` as well as the heading, so
"the sentinel appears somewhere in the document" was still true.

So the mutation did not count as a demonstration, and the **checker** was fixed
rather than the mutation excused. `scripts/smoke-worker.cljs` now also asserts
the sentinel inside the heading element it renders
(`data-size="45">…</h1>`). Re-run against the same mutation, that check goes
red on both apps.

### Mutation 7's bundle did not throw — it lied

The expectation was that a bundle shipped with an undeclared-var warning throws
on its first request. It did not: it returned **200** with a page that had lost
its route table (`/health` not advertised, wrong route count, `/health` itself
not naming the app). That is worse than a throw, and it is what the smoke gate
caught — 3 checks red against a build that had exited 0.

Mutations 3–5 exist because a single check could not distinguish the cases:

- **`dads-table` alone cannot fail.** It is markup the view emits, present
  whether or not any stylesheet was inlined. Measured on this branch's own page
  (`view/render` with the real CSS vs `:css ""`):

  | | with the CSS | without it |
  |---|---:|---:|
  | page bytes | 80,675 | 8,577 |
  | `dads-table` | 74 | **6** — never 0 |
  | `class="dads-table"` (what the smoke asserts) | 1 | **1** — still green |
  | `--color-primitive-blue` (what the smoke asserts) | 45 | **0** — goes red |

  "The view called the library" and "the stylesheet is in the bundle" are two
  claims, so they are two checks. A single `dads-table` assertion would have
  passed on a page carrying no stylesheet at all.
- **One value sentinel alone cannot fail.** A single "must not appear" check
  passes for an implementation that hides everything; a single "must appear"
  check passes for one that shows everything. The smoke uses two, on two
  different vars — `APP_UI_TYPE` carries a value that must never render,
  `APP_DISPLAY_NAME` carries one that must.

Mutation 7 is the reason `:warnings-as-errors` is asserted by EDN path rather
than by grep: with the key under `:build-options`, shadow ignores it silently
and ships a bundle that throws on its first request, while the build prints
`Build completed` and exits 0.

After every restore the bundles were rebuilt and their `sha256` compared to the
pre-mutation values, because several agents share `/tmp` on this machine and a
foreign backup would otherwise be indistinguishable from a working restore.
