/**
 * credits kotoba — credit ledger & public-fund routing, maximal migration.
 *
 * Per ADR-2606011400 (Consensys product-front / infra-back) + ADR-2605172400
 * (3-axis Liability/Custody/Settlement OR-test) + ADR-2605181100 (kotoba E2E
 * encrypted-record envelope) + ADR-2605172100 (Operating Entity Boundary:
 * etzhayyim NEVER becomes the fiat merchant-of-record / counterparty).
 *
 * SPLIT (front everything that can move):
 *   PLAINTEXT AT records (public reference / catalog / aggregate) —
 *     allocationDestination: the public-fund routing catalog (id/label/role),
 *     creditRate: earn/spend rate reference (decimal-string costs). Open
 *     metadata anyone may read; no per-person data.
 *   kotoba E2E (com.etzhayyim.encrypted.record) — PER-PERSON ledger + private
 *     config. ledgerEntry (every balance-affecting credit transaction:
 *     userDid/type/amount/balanceAfter) and allocationPreference (user's chosen
 *     destination) sealed via sdk.encryptedWrite; read-cap = owner DID +
 *     explicit recipients. Balance = derived by replaying the owner's own
 *     ledger entries (E2E), so the substrate never sees a user's balance or tx
 *     history in plaintext.
 *
 *   STAYS etzhayyim (consumed via consent-capability, NOT a collection) —
 *     the irreducible regulated EXECUTION: the FIAT settlement / merchant-of-
 *     record rail for credit PURCHASE (30%-fee fiat clearing via the etzhayyim
 *     payment processor). Per ADR-2605172100 etzhayyim can never be the fiat
 *     MoR/counterparty, so the purchase transaction DATA migrates here as an
 *     E2E ledgerEntry, but the fiat-rail settlement CALL stays etzhayyim. Also etzhayyim:
 *     GCC on-chain mint/treasury EXECUTION + key/credential custody.
 *
 * AT-Lexicon: no float — integers only; credit/money amounts as decimal
 * STRINGS; basis-points / percentages as integer 0..N.
 */

// ─── Plaintext public collections ───────────────────────────────────
export const ALLOC_DEST_COLLECTION = "com.etzhayyim.apps.credits.allocationDestination";
export const CREDIT_RATE_COLLECTION = "com.etzhayyim.apps.credits.creditRate";

// ─── E2E inner-type NSIDs (body shape inside the encrypted envelope) ─
export const LEDGER_ENTRY_INNER_TYPE = "com.etzhayyim.apps.credits.ledgerEntry";
export const ALLOC_PREF_INNER_TYPE = "com.etzhayyim.apps.credits.allocationPreference";

export const CREDITS_DID_PREFIX = "did:web:credits.etzhayyim.com:" as const;

export type LedgerEntryType = "earn" | "purchase" | "spend" | "allocation";

// ─── Allocation destination (PLAINTEXT, public catalog) ─────────────

export interface AllocationDestinationRecord {
  did: string;
  destinationId: string;
  label: string;
  role: string;
  createdAt: string;
}
export interface AllocationDestinationView extends AllocationDestinationRecord {
  destinationUri: string;
}
export interface RegisterDestinationInput {
  destinationId: string;
  label: string;
  role: string;
}
export interface RegisterDestinationOutput {
  status: "registered" | "alreadyExists" | "rejected";
  destinationUri?: string;
  did?: string;
  destinationId?: string;
  error?: string;
}
export interface GetDestinationInput {
  destinationId: string;
}
export interface GetDestinationOutput {
  destination?: AllocationDestinationView;
  error?: string;
}
export interface ListDestinationsInput {
  role?: string;
  limit?: number;
  cursor?: string;
}
export interface ListDestinationsOutput {
  items: AllocationDestinationView[];
  cursor?: string;
  total: number;
}

// ─── Credit rate (PLAINTEXT, public reference) ──────────────────────

export interface CreditRateRecord {
  did: string;
  rateId: string;
  /** "earn" | "spend". */
  kind: string;
  /** e.g. "hc-translation", "post". */
  action: string;
  /** Decimal STRING (no float in AT-Lexicon), e.g. "3", "0.5". */
  amount: string;
  createdAt: string;
}
export interface CreditRateView extends CreditRateRecord {
  rateUri: string;
}
export interface RegisterRateInput {
  rateId: string;
  kind: string;
  action: string;
  amount: string;
}
export interface RegisterRateOutput {
  status: "registered" | "alreadyExists" | "rejected";
  rateUri?: string;
  did?: string;
  rateId?: string;
  error?: string;
}
export interface ListRatesInput {
  kind?: string;
  limit?: number;
  cursor?: string;
}
export interface ListRatesOutput {
  items: CreditRateView[];
  cursor?: string;
  total: number;
}

// ─── Ledger entry (E2E-ENCRYPTED, per-person ledger) ────────────────

export interface LedgerEntryBody {
  entryId: string;
  userDid: string;
  type: LedgerEntryType;
  /** Signed credit delta as decimal STRING, e.g. "100", "-1.5". */
  amount: string;
  /** Running balance after this entry, decimal STRING. */
  balanceAfter: string;
  /** Free-form source/action tag, e.g. "hc-translation", "post", "purchase". */
  source: string;
  /**
   * For purchase entries: the etzhayyim fiat-settlement reference returned by the
   * regulated merchant-of-record rail (which STAYS etzhayyim). Opaque pointer only;
   * no card/PAN data ever lands here.
   */
  fiatSettlementRef?: string;
  description?: string;
  occurredAt: string;
}
export interface LedgerEntryView extends LedgerEntryBody {
  uri: string;
  sender: string;
  createdAt: string;
}
export interface RecordEntryInput {
  entryId: string;
  userDid: string;
  type: LedgerEntryType;
  amount: string;
  balanceAfter: string;
  source: string;
  fiatSettlementRef?: string;
  description?: string;
  occurredAt?: string;
  /** Extra DIDs to grant read-cap (owner always included). */
  recipients?: string[];
}
export interface RecordEntryOutput {
  status: "recorded" | "rejected";
  uri?: string;
  keyId?: string;
  entryId?: string;
  error?: string;
}
export interface ListEntriesInput {
  userDid?: string;
  type?: LedgerEntryType;
  limit?: number;
  cursor?: string;
}
export interface ListEntriesOutput {
  items: LedgerEntryView[];
  cursor?: string;
  total: number;
}
export interface GetEntryInput {
  entryId: string;
}
export interface GetEntryOutput {
  entry?: LedgerEntryView;
  error?: string;
}
export interface GetBalanceInput {
  userDid: string;
}
export interface GetBalanceOutput {
  /** Latest balanceAfter for the user's most recent ledger entry, decimal STRING. */
  balance?: string;
  entryCount?: number;
  error?: string;
}

// ─── Allocation preference (E2E-ENCRYPTED, private user config) ─────

export interface AllocationPreferenceBody {
  userDid: string;
  destinationId: string;
  title: string;
  /** Allocation basis-points (integer 0..10000), e.g. 1000 = 10%. */
  allocationBps: number;
  setAt: string;
}
export interface AllocationPreferenceView extends AllocationPreferenceBody {
  uri: string;
  sender: string;
  createdAt: string;
}
export interface SetPreferenceInput {
  userDid: string;
  destinationId: string;
  title: string;
  allocationBps: number;
  recipients?: string[];
}
export interface SetPreferenceOutput {
  status: "set" | "rejected";
  uri?: string;
  keyId?: string;
  userDid?: string;
  error?: string;
}
export interface GetPreferenceInput {
  userDid: string;
}
export interface GetPreferenceOutput {
  preference?: AllocationPreferenceView;
  error?: string;
}

// ─── Coverage rollup ────────────────────────────────────────────────

export interface CoverageInput {
  maxScan?: number;
}
export interface CoverageOutput {
  allocationDestinationCount?: number;
  creditRateCount?: number;
  ledgerEntryCount?: number;
  allocationPreferenceCount?: number;
  entriesByType?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Validation + helpers ───────────────────────────────────────────

/** Decimal string: optional leading '-', digits, optional fractional part. */
export function isDecimalString(s: unknown): s is string {
  return typeof s === "string" && /^-?\d+(\.\d+)?$/.test(s);
}
export function isBps(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10000;
}
export function destinationDidFor(id: string): string {
  return `${CREDITS_DID_PREFIX}dest:${id.toLowerCase()}`;
}
export function rateDidFor(id: string): string {
  return `${CREDITS_DID_PREFIX}rate:${id.toLowerCase()}`;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
export function destinationRkey(id: string): string {
  return `dest-${slug(id)}`;
}
export function rateRkey(id: string): string {
  return `rate-${slug(id)}`;
}
export function entryRkey(id: string): string {
  return `entry-${slug(id)}`;
}
export function preferenceRkey(userDid: string): string {
  return `pref-${slug(userDid)}`;
}
