# app-credits — operator quickstart

**Nothing in this repository deploys as-is, and the credit model it describes has
been superseded.** That is the first thing an operator needs, because the four
documents at the top of the tree (`CLAUDE.md`, `PROJECT.jsonld`,
`appview/credits-mcp-component/README.md`, `TOKEN_DESIGN_ETHEREUM.md`) all read
like a live service.

Everything below was walked on 2026-08-16 against commit `da7e2cc`. Commands are
given so you can re-walk them rather than trust this page.

---

## 1. What is actually here

```bash
git ls-files | wc -l                                   # 86
git ls-files | awk -F/ 'NF>1{print $1"/"} NF==1{print $1}' | sort | uniq -c | sort -rn
```

| Path | Files | What it is |
|---|---:|---|
| `evm/` | 45 | 1 own contract (`contracts/GCCStablecoin.sol`, 315 lines) + 43 files of Circle's USDC vendored verbatim + 1 runbook |
| `appview/` | 26 | two Cloudflare Worker facades, neither buildable here (§3) |
| `kotoba/` | 7 | the only executable, tested code — 594 lines of TS + 153 lines of test (§4) |
| top level | 8 | `CLAUDE.md` 5,447 B, `TOKEN_DESIGN_ETHEREUM.md` 8,522 B, `PROJECT.jsonld` 2,067 B, `MIGRATION-TODO.md` 2,112 B, `NOTICE` 538 B, `README.edn` 141 B, `migration.edn` 203 B, `OWNERS` **0 B** |

There is no `src/` and no `test/` at the repository root. That is not an
oversight to correct — the substrate lives under `kotoba/`, and the vendored
`evm/third_party/usdc/` is upstream code that this repository does not own
(`evm/third_party/usdc/UPSTREAM.md`: circlefin/stablecoin-evm at
`f2f8b3bb`, no local edits).

## 2. Where the live successor is

`CLAUDE.md` line 1 points at
`orgs/etzhayyim/com-etzhayyim-credits/actor-manifest.jsonld`. **That path does
not exist**, in this workspace or in `manifest/west.yml`. The repository moved
orgs; GitHub still redirects the name, which is why the pointer looks valid:

```bash
gh api repos/etzhayyim/com-etzhayyim-credits --jq .full_name   # -> cloud-itonami/credits
```

The successor is **`orgs/cloud-itonami/credits`** — the ENGI mutual-credit
kernel. Its own README states the relationship plainly: *"ENGI replaces the
centrally issued GCC/credit model. `EN` … is not an ERC-20, is not purchased
from etzhayyim, has no owner or administrator."*

That contradicts, by design, the model documented in this repository's
`CLAUDE.md`: a 30 % purchase fee, an admin minter, and a Safe treasury. Read
`CLAUDE.md` here as a description of the **legacy** design, not the target one.
`cloud-itonami/credits/actor-manifest.jsonld` carries `"enabled": false` with
the reason *"Central earn/purchase/spend writer superseded by participant-owned
ENGI journals; retained read-only for opt-in reconciliation."*

## 3. Why neither Worker deploys

Both `wrangler.jsonc` files name a `main` that is a SvelteKit build artifact,
and neither artifact is committed or present:

```bash
for w in appview/credits-mcp-component appview/etzhayyim-wasm-wallet-wt1e2f3g; do
  m=$(grep -o '"main": *"[^"]*"' "$w/wrangler.jsonc" | sed 's/.*: *"//;s/"$//')
  printf '%-42s %s committed=' "$w" "$m"
  git ls-files --error-unmatch "$w/$m" >/dev/null 2>&1 && echo YES || echo NO
done
# both -> svelte/.svelte-kit/cloudflare/_worker.js committed=NO
```

So `wrangler deploy` needs a SvelteKit build first, and the SvelteKit sources
are not what the surrounding docs describe (§5).

Every hostname these Workers route to or call resolves to nothing:

```bash
for h in credits.etzhayyim.com a5ce95af.etzhayyim.com wt1e2f3g.etzhayyim.com \
         mcp.etzhayyim.com dispatcher.etzhayyim.com etzhayyim.com yoro.etzhayyim.com; do
  printf '%-30s %s\n' "$h" "$(dig +short $h A | tr '\n' ' ')"
done
```

| Host | Role | A record (2026-08-16) |
|---|---|---|
| `credits.etzhayyim.com` | route in `credits-mcp-component/wrangler.jsonc` | **none** |
| `a5ce95af.etzhayyim.com` | route, and `APP_EMBED_URL` | **none** |
| `wt1e2f3g.etzhayyim.com` | route in the wallet's `wrangler.jsonc` | **none** |
| `dispatcher.etzhayyim.com` | upstream of both `src/app.ts` proxies | **none** |
| `mcp.etzhayyim.com` | upstream of the wallet's `xrpc/[...path]/+server.ts` | **none** |
| `etzhayyim.com` | apex | 104.21.51.111, 172.67.179.128 |
| `yoro.etzhayyim.com` | the app these credits were for | 172.67.179.128, 104.21.51.111 |

The zone is alive; these five names are not in it. Deploying would publish a
Worker whose every request path fails at the first hop.

## 4. The one thing you can run — `kotoba/`

594 lines of TypeScript implementing the *c-split* credits model: a plaintext
public catalog (`allocationDestination`, `creditRate`) plus a per-person ledger
sealed with `encryptedWrite`/`encryptedRead`, with balance derived by replaying
the owner's own entries. 8 tests.

**The declared install does not work on npm ≥ 11.16.** `npm install` fails with
`EALLOWSCRIPTS`, because `@etzhayyim/sdk` has a `prepare: tsc` script and npm no
longer runs git-dependency prepare scripts in a project-scoped install.

It still runs, because `@etzhayyim/sdk` is imported **type-only**
(`kotoba/src/registry.ts:17` is `import type { Etzhayyim }`), so at runtime the
suite needs nothing but the mock — which is a single 309-line source file with
`main: src/index.ts` and no build step. Both dependency repos have also moved
org (`etzhayyim/com-etzhayyim-sdk` → `kotoba-lang/sdk`); the git URLs in
`kotoba/package.json` still resolve only through GitHub's redirect.

```bash
# 1. the mock, at the SHA kotoba/package.json pins
git clone https://github.com/kotoba-lang/sdk-mock.git /tmp/credsdk/sdk-mock
git -C /tmp/credsdk/sdk-mock checkout c857ff9be5310bf433bfe1e8d3c0f677e213d667

# 2. a runner outside this package, so npm never reads its package.json
mkdir -p /tmp/credits-vitest && cd /tmp/credits-vitest
printf '{"name":"credits-vitest-runner","private":true,"type":"module"}\n' > package.json
npm install vitest@4

# 3. make both resolvable from the package, then run
cd <repo>/kotoba
for p in /tmp/credits-vitest/node_modules/*; do
  n=$(basename "$p"); [ "$n" = .bin ] && continue
  case "$n" in
    @*) mkdir -p "node_modules/$n"
        for q in "$p"/*; do ln -sfn "$q" "node_modules/$n/$(basename "$q")"; done ;;
     *) ln -sfn "$p" "node_modules/$n" ;;
  esac
done
mkdir -p node_modules/@etzhayyim   # vitest has no @etzhayyim scope, so the loop above never made this
ln -sfn /tmp/credsdk/sdk-mock node_modules/@etzhayyim/sdk-mock
/tmp/credits-vitest/node_modules/.bin/vitest run --root .
#  Test Files  1 passed (1)
#       Tests  8 passed (8)
```

`node_modules/` is not ignored here — delete it when you are done rather than
committing it.

### The suite discriminates, and one part of it did not

Green is worth nothing on its own, so it was measured against deliberate breaks:

| Break | Result |
|---|---|
| `getBalance` returns `mine[0]` instead of `mine[mine.length - 1]` | 1 failed — `expected '100' to be '169'` |
| `recordEntry` hardcodes `recipients: ["did:web:outsider.example"]` | 2 failed |
| `setPreference` hardcodes the same | 1 failed |
| no change | 8 passed |

**The last two only fail as of this commit.** The three read-cap tests used to
construct a *fresh* `new MockEtzhayyim({ did: outsider })` and assert it saw
nothing — but each `MockEtzhayyim` owns a private store, so that instance had
never observed the write at all. The assertion held for any implementation,
including one that granted the outsider a read-cap on every entry: that exact
mutation left the old suite green at 8/8. They now flip `did` on the client that
holds the records (`readAs` in `kotoba/test/credits.test.ts`), so the store is
the same and only the asker changes.

`kotoba/src/` was not modified — the breaks above were applied and reverted, and
`git diff --quiet -- kotoba/src` is clean.

## 5. What the appview docs claim that is not there

`appview/credits-mcp-component/README.md` and the "Svelte Demo Console" section
of `CLAUDE.md` describe endpoints that exist in no source file in this
repository. Measured:

```bash
for p in /health /healthz /readyz /api/mcp /api/plans /api/balance; do
  printf '%-12s %s\n' "$p" "$(grep -rl -- "$p" appview/credits-mcp-component | tr '\n' ' ')"
done
```

| Documented | Where it actually appears |
|---|---|
| `GET /health` | `src/app.ts` ✅ |
| `GET /healthz`, `GET /readyz`, `POST /api/mcp` | the README only |
| `GET /api/plans`, `GET /api/balance/{userId}` | the README only |
| under `wasm/credits-mcp-component/svelte` | there is no `wasm/` directory |

The SvelteKit app for `credits-mcp-component` has exactly one route,
`svelte/src/routes/+page.svelte`, which renders `App.svelte`: an `<h1>` and the
line *"Vite entry scaffold after SvelteKit cleanup."* There is no `/api/*` and no
`/xrpc` handler in it. The wallet appview has two routes and does have an
`xrpc/[...path]/+server.ts` — but it forwards to `mcp.etzhayyim.com`, a
different upstream from the `dispatcher.etzhayyim.com` that its own
`src/app.ts` proxies to. Neither resolves.

Of the 14 MCP command names the README lists (`GetBalance`, `PurchaseCredits`,
`SpendCredits`, …), exactly one string occurs anywhere in the repository:
`GetBalance`, and only as the TypeScript type names `GetBalanceInput` /
`GetBalanceOutput` in `kotoba/src/types.ts`. The commands are dispatcher NSIDs;
their implementation was never in this repository. `src/app.ts` says so in its
first line — *"Ledger and reward logic run in AgentGateway MCP + pod-side
LangServer"* — and names
`40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/ingest/credits.py`,
which is a path in the pre-split etzhayyim monorepo, not here.

The README has been corrected in this commit; `CLAUDE.md`'s legacy sections are
left as the historical design record, with the pointer in §2 fixed.

## 6. The GCC token is real, and it is on mainnet

Unlike the hostnames, the four Ethereum addresses in `CLAUDE.md` are live
contracts. Read at block **25765715** (2026-08-16T06:06:40Z), via
`https://ethereum-rpc.publicnode.com`:

```bash
RPC=https://ethereum-rpc.publicnode.com
T=0x799d24a6FFBb758C6E2Ed8f981822A17Eaa5F30B
call(){ curl -sS -X POST $RPC -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$T\",\"data\":\"$1\"},\"latest\"]}"; }
call 0x06fdde03   # name()
call 0x95d89b41   # symbol()
call 0x313ce567   # decimals()
call 0x18160ddd   # totalSupply()
call 0x8da5cb5b   # owner()
call 0x35d99f35   # masterMinter()
call 0x5c975abb   # paused()
```

| Property | Value |
|---|---|
| `name()` | `Gftd Computing Credits` — note **Gftd**, where `PROJECT.jsonld` says "Etzhayyim Computing Credits" |
| `symbol()` / `decimals()` | `GCC` / `6` |
| `totalSupply()` | 10,000,006.711595 GCC |
| `owner()` = `masterMinter()` | `0xA00366234D29d4F882088048c0B2fa0dB7302D4E` — the address `CLAUDE.md` labels "Safe Treasury" |
| `balanceOf(Safe)` | 10,000,000 GCC — 99.99993 % of supply |
| `paused()` | `false` |
| `isMinter(0xAf80…253d9)` | `true` — the "GCC Minter" row is a configured minter |

So the treasury Safe is simultaneously owner, master minter, and holder of
effectively the entire supply. That is what `GCCStablecoin.sol` intends
(*"Safe を masterMinter/owner 運用にすることで、Safe から発行統制できる"*), and it
is exactly the arrangement ENGI was created to replace — `cloud-itonami/credits`
forbids a "privileged mint key, treasury mint, admin balance edit".

One caveat: `supplyCap()` reverts on the deployed contract, though
`GCCStablecoin.sol` declares `uint256 public immutable supplyCap`. The deployed
bytecode is therefore **not** this exact source. Do not treat
`evm/contracts/GCCStablecoin.sol` as verified-matching until someone compares it
against the verified source on a block explorer.

## 7. If you have been asked to change something here

1. **New value flows go to `orgs/cloud-itonami/credits`** (ENGI), not here.
2. **Reconciliation of existing GCC** touches on-chain state controlled by the
   Safe at `0xA003…2D4E`. That is a treasury operation with a runbook
   (`evm/docs/SAFE_ISSUANCE_RUNBOOK.md`, 43 lines) — not a code change in this
   repository.
3. **Do not deploy either Worker** without first restoring the five DNS names
   and the dispatcher/MCP upstreams. Until then a deploy publishes a proxy to
   nowhere.
4. `kotoba/` is the part worth keeping alive; run its suite (§4) before and
   after any change to it.
