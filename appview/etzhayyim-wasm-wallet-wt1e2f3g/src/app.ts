// wallet.etzhayyim.com thin edge facade. Credit ledger operations are handled by credits AgentGateway MCP + pod-side LangServer.

interface SecretBinding { get(): Promise<string>; }
interface Env { DISPATCHER_URL?: string; DISPATCHER_INTERNAL_SECRET?: string | SecretBinding; APP_NANOID?: string; }

const APP = "wallet";
const ACTOR = "did:web:wallet.etzhayyim.com";
const CREDIT_PREFIX = "com.etzhayyim.apps.credits.";
const WALLET_PREFIX = "com.etzhayyim.apps.wallet.";

const WALLET_TO_CREDITS: Record<string, string> = {
  "com.etzhayyim.apps.wallet.checkSpendAllowed": "com.etzhayyim.apps.credits.checkSpendAllowed",
  "com.etzhayyim.apps.wallet.spendCredits": "com.etzhayyim.apps.credits.spendCredits",
  "com.etzhayyim.apps.wallet.rewardFromCompute": "com.etzhayyim.apps.credits.rewardFromCompute",
  "com.etzhayyim.apps.wallet.rewardFromHC": "com.etzhayyim.apps.credits.rewardFromHC",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health" || url.pathname === "/healthz" || url.pathname === "/_app/meta") {
      return json({
        ok: true,
        actor: ACTOR,
        nanoid: env.APP_NANOID ?? "wt1e2f3g",
        execution: "edge-proxy+agentgateway-mcp+langserver",
        businessLogic: "40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/ingest/credits.py",
        bpmn: "etzhayyim-root/00-contracts/bpmn/com/etzhayyim/credits",
      });
    }

    const nsid = url.pathname.startsWith("/xrpc/") ? url.pathname.slice("/xrpc/".length) : "";
    const targetNsid = WALLET_TO_CREDITS[nsid] ?? (nsid.startsWith(CREDIT_PREFIX) ? nsid : "");
    if (targetNsid && (req.method === "POST" || req.method === "GET")) {
      const body = await bodyWithQuery(req, url);
      if (body.__invalidJson) return json({ error: "InvalidJson" }, 400);
      return proxyToDispatcher(env, targetNsid, body);
    }
    if (nsid.startsWith(WALLET_PREFIX)) {
      return json({ error: "NotImplemented", message: "wallet-specific EVM operations are not implemented in the edge worker" }, 501);
    }
    return json({ error: "NotFound", message: `${APP} not found` }, 404);
  },
} satisfies ExportedHandler<Env>;

async function bodyWithQuery(req: Request, url: URL): Promise<Record<string, unknown>> { let body: Record<string, unknown> = {}; if (req.method === "POST") { const text = await req.text(); try { body = text ? JSON.parse(text) : {}; } catch { return { __invalidJson: true }; } } for (const [k, v] of url.searchParams) if (!(k in body)) body[k] = v; return body; }
async function proxyToDispatcher(env: Env, nsid: string, body: Record<string, unknown>): Promise<Response> { const base = (env.DISPATCHER_URL ?? "https://dispatcher.etzhayyim.com").replace(/\/+$/, ""); const headers: Record<string, string> = { "content-type": "application/json" }; const trust = await internalTrustSecret(env); if (trust) headers["x-internal-trust"] = trust; const resp = await fetch(`${base}/xrpc/${nsid}`, { method: "POST", headers, body: JSON.stringify(body) }); const text = await resp.text(); return new Response(text, { status: resp.status, headers: { "content-type": resp.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } }); }
async function internalTrustSecret(env: Env): Promise<string> { const binding = env.DISPATCHER_INTERNAL_SECRET; if (!binding) return ""; try { return typeof binding === "string" ? binding : await binding.get(); } catch { return ""; } }
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } }); }
