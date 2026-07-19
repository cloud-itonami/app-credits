/**
 * credits kotoba — registry.
 *
 * Plaintext path (allocationDestination / creditRate): sdk.write / sdk.read —
 * public catalog + rate reference.
 * E2E path (ledgerEntry / allocationPreference): sdk.encryptedWrite /
 * sdk.encryptedRead — per-person ledger + private config sealed in the kotoba
 * envelope (ADR-2605181100), read-cap = owner DID. The substrate never sees a
 * user's balance, transaction history, or chosen destination in plaintext.
 *
 * Balance is DERIVED by replaying the owner's own E2E ledger entries — no
 * server-side balance projection. The fiat-rail settlement CALL stays etzhayyim
 * (consumed via consent-capability); only an opaque fiatSettlementRef pointer
 * is recorded on a purchase entry.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  ALLOC_DEST_COLLECTION,
  ALLOC_PREF_INNER_TYPE,
  CREDIT_RATE_COLLECTION,
  LEDGER_ENTRY_INNER_TYPE,
  destinationDidFor,
  destinationRkey,
  entryRkey,
  isBps,
  isDecimalString,
  preferenceRkey,
  rateDidFor,
  rateRkey,
  type AllocationDestinationRecord,
  type AllocationDestinationView,
  type AllocationPreferenceBody,
  type AllocationPreferenceView,
  type CoverageInput,
  type CoverageOutput,
  type CreditRateRecord,
  type CreditRateView,
  type GetBalanceInput,
  type GetBalanceOutput,
  type GetDestinationInput,
  type GetDestinationOutput,
  type GetEntryInput,
  type GetEntryOutput,
  type GetPreferenceInput,
  type GetPreferenceOutput,
  type LedgerEntryBody,
  type LedgerEntryView,
  type ListDestinationsInput,
  type ListDestinationsOutput,
  type ListEntriesInput,
  type ListEntriesOutput,
  type ListRatesInput,
  type ListRatesOutput,
  type RecordEntryInput,
  type RecordEntryOutput,
  type RegisterDestinationInput,
  type RegisterDestinationOutput,
  type RegisterRateInput,
  type RegisterRateOutput,
  type SetPreferenceInput,
  type SetPreferenceOutput,
} from "./types.js";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

// ─── Allocation destination (PLAINTEXT) ─────────────────────────────

export async function registerDestination(e: Etzhayyim, input: RegisterDestinationInput): Promise<RegisterDestinationOutput> {
  if (!input.destinationId || !input.label || !input.role) return { status: "rejected", error: "missingRequiredFields" };
  const rkey = destinationRkey(input.destinationId);
  const existing = await e.read<AllocationDestinationRecord>({ collection: ALLOC_DEST_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", destinationUri: existing.records[0].uri, did: existing.records[0].value.did, destinationId: input.destinationId };
  }
  const now = new Date().toISOString();
  const did = destinationDidFor(input.destinationId);
  const record: AllocationDestinationRecord = {
    did,
    destinationId: input.destinationId,
    label: input.label,
    role: input.role,
    createdAt: now,
  };
  const receipt = await e.write({ collection: ALLOC_DEST_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "registered", destinationUri: receipt.uri, did, destinationId: input.destinationId };
}

export async function getDestination(e: Etzhayyim, input: GetDestinationInput): Promise<GetDestinationOutput> {
  if (!input.destinationId) return { error: "invalidDestinationId" };
  const resp = await e.read<AllocationDestinationRecord>({ collection: ALLOC_DEST_COLLECTION, rkey: destinationRkey(input.destinationId) }).catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r?.value) return { error: "notFound" };
  return { destination: { ...r.value, destinationUri: r.uri } };
}

export async function listDestinations(e: Etzhayyim, input: ListDestinationsInput = {}): Promise<ListDestinationsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<AllocationDestinationRecord>({ collection: ALLOC_DEST_COLLECTION, cursor: input.cursor, limit });
  const items: AllocationDestinationView[] = resp.records
    .filter((r) => !input.role || r.value.role === input.role)
    .map((r) => ({ ...r.value, destinationUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Credit rate (PLAINTEXT) ────────────────────────────────────────

export async function registerRate(e: Etzhayyim, input: RegisterRateInput): Promise<RegisterRateOutput> {
  if (!input.rateId || !input.kind || !input.action) return { status: "rejected", error: "missingRequiredFields" };
  if (!isDecimalString(input.amount)) return { status: "rejected", error: "invalidAmount" };
  const rkey = rateRkey(input.rateId);
  const existing = await e.read<CreditRateRecord>({ collection: CREDIT_RATE_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", rateUri: existing.records[0].uri, did: existing.records[0].value.did, rateId: input.rateId };
  }
  const now = new Date().toISOString();
  const did = rateDidFor(input.rateId);
  const record: CreditRateRecord = {
    did,
    rateId: input.rateId,
    kind: input.kind,
    action: input.action,
    amount: input.amount,
    createdAt: now,
  };
  const receipt = await e.write({ collection: CREDIT_RATE_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "registered", rateUri: receipt.uri, did, rateId: input.rateId };
}

export async function listRates(e: Etzhayyim, input: ListRatesInput = {}): Promise<ListRatesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<CreditRateRecord>({ collection: CREDIT_RATE_COLLECTION, cursor: input.cursor, limit });
  const items: CreditRateView[] = resp.records
    .filter((r) => !input.kind || r.value.kind === input.kind)
    .map((r) => ({ ...r.value, rateUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Ledger entry (E2E-ENCRYPTED) ───────────────────────────────────

export async function recordEntry(e: Etzhayyim, input: RecordEntryInput): Promise<RecordEntryOutput> {
  if (!input.entryId || !input.userDid || !input.type || !input.source) return { status: "rejected", error: "missingRequiredFields" };
  if (!isDecimalString(input.amount)) return { status: "rejected", error: "invalidAmount" };
  if (!isDecimalString(input.balanceAfter)) return { status: "rejected", error: "invalidBalanceAfter" };
  const body: LedgerEntryBody = {
    entryId: input.entryId,
    userDid: input.userDid,
    type: input.type,
    amount: input.amount,
    balanceAfter: input.balanceAfter,
    source: input.source,
    fiatSettlementRef: input.fiatSettlementRef,
    description: input.description,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
  // Read-cap = owner DID (sender, auto-wrapped) + any explicit recipients.
  const receipt = await e.encryptedWrite<Record<string, unknown>>({
    innerType: LEDGER_ENTRY_INNER_TYPE,
    record: body as unknown as Record<string, unknown>,
    recipients: input.recipients ?? [],
    rkey: entryRkey(input.entryId),
  });
  return { status: "recorded", uri: receipt.uri, keyId: receipt.keyId, entryId: input.entryId };
}

async function scanEntries(e: Etzhayyim, maxScan: number): Promise<LedgerEntryView[]> {
  const out: LedgerEntryView[] = [];
  let cursor: string | undefined;
  while (out.length < maxScan) {
    const page = await e.encryptedRead<LedgerEntryBody>({ innerType: LEDGER_ENTRY_INNER_TYPE, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      out.push({ ...r.value, uri: r.uri, sender: r.sender, createdAt: r.createdAt });
    }
    if (!page.cursor || page.records.length === 0) break;
    cursor = page.cursor;
  }
  return out;
}

export async function listEntries(e: Etzhayyim, input: ListEntriesInput = {}): Promise<ListEntriesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const all = await scanEntries(e, DEFAULT_MAX_SCAN);
  const filtered = all.filter((x) => (!input.userDid || x.userDid === input.userDid) && (!input.type || x.type === input.type));
  return { items: filtered.slice(0, limit), total: filtered.length };
}

export async function getEntry(e: Etzhayyim, input: GetEntryInput): Promise<GetEntryOutput> {
  if (!input.entryId) return { error: "invalidEntryId" };
  const all = await scanEntries(e, DEFAULT_MAX_SCAN);
  const found = all.find((x) => x.entryId === input.entryId);
  if (!found) return { error: "notFound" };
  return { entry: found };
}

/**
 * Derive a user's balance by replaying their own E2E ledger entries. Returns
 * the balanceAfter of the chronologically latest entry (entries are stored in
 * insertion order). No server-side balance projection exists.
 */
export async function getBalance(e: Etzhayyim, input: GetBalanceInput): Promise<GetBalanceOutput> {
  if (!input.userDid) return { error: "invalidUserDid" };
  const all = await scanEntries(e, DEFAULT_MAX_SCAN);
  const mine = all.filter((x) => x.userDid === input.userDid);
  if (mine.length === 0) return { balance: "0", entryCount: 0 };
  return { balance: mine[mine.length - 1].balanceAfter, entryCount: mine.length };
}

// ─── Allocation preference (E2E-ENCRYPTED) ──────────────────────────

export async function setPreference(e: Etzhayyim, input: SetPreferenceInput): Promise<SetPreferenceOutput> {
  if (!input.userDid || !input.destinationId || !input.title) return { status: "rejected", error: "missingRequiredFields" };
  if (!isBps(input.allocationBps)) return { status: "rejected", error: "invalidAllocationBps" };
  const body: AllocationPreferenceBody = {
    userDid: input.userDid,
    destinationId: input.destinationId,
    title: input.title,
    allocationBps: input.allocationBps,
    setAt: new Date().toISOString(),
  };
  const receipt = await e.encryptedWrite<Record<string, unknown>>({
    innerType: ALLOC_PREF_INNER_TYPE,
    record: body as unknown as Record<string, unknown>,
    recipients: input.recipients ?? [],
    rkey: preferenceRkey(input.userDid),
  });
  return { status: "set", uri: receipt.uri, keyId: receipt.keyId, userDid: input.userDid };
}

async function scanPreferences(e: Etzhayyim, maxScan: number): Promise<AllocationPreferenceView[]> {
  const out: AllocationPreferenceView[] = [];
  let cursor: string | undefined;
  while (out.length < maxScan) {
    const page = await e.encryptedRead<AllocationPreferenceBody>({ innerType: ALLOC_PREF_INNER_TYPE, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      out.push({ ...r.value, uri: r.uri, sender: r.sender, createdAt: r.createdAt });
    }
    if (!page.cursor || page.records.length === 0) break;
    cursor = page.cursor;
  }
  return out;
}

export async function getPreference(e: Etzhayyim, input: GetPreferenceInput): Promise<GetPreferenceOutput> {
  if (!input.userDid) return { error: "invalidUserDid" };
  const all = await scanPreferences(e, DEFAULT_MAX_SCAN);
  // Latest preference for the user wins (entries stored in insertion order).
  const mine = all.filter((x) => x.userDid === input.userDid);
  if (mine.length === 0) return { error: "notFound" };
  return { preference: mine[mine.length - 1] };
}

// ─── Coverage rollup ────────────────────────────────────────────────

export async function coverage(e: Etzhayyim, input: CoverageInput = {}): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);

  const countPlaintext = async (collection: string): Promise<number> => {
    let total = 0;
    let cursor: string | undefined;
    while (total < maxScan) {
      const page = await e.read<Record<string, unknown>>({ collection, cursor, limit: PAGE_LIMIT });
      total += page.records.length;
      if (!page.cursor || page.records.length < PAGE_LIMIT) break;
      cursor = page.cursor;
    }
    return total;
  };

  const allocationDestinationCount = await countPlaintext(ALLOC_DEST_COLLECTION);
  const creditRateCount = await countPlaintext(CREDIT_RATE_COLLECTION);
  const entries = await scanEntries(e, maxScan);
  const preferences = await scanPreferences(e, maxScan);

  const entriesByType: Record<string, number> = {};
  for (const x of entries) entriesByType[x.type] = (entriesByType[x.type] ?? 0) + 1;

  return {
    allocationDestinationCount,
    creditRateCount,
    ledgerEntryCount: entries.length,
    allocationPreferenceCount: preferences.length,
    entriesByType,
    truncated:
      allocationDestinationCount >= maxScan ||
      creditRateCount >= maxScan ||
      entries.length >= maxScan ||
      preferences.length >= maxScan,
  };
}
