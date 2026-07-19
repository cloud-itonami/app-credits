/**
 * credits kotoba — barrel. Plaintext public catalog (allocationDestination +
 * creditRate) + kotoba-E2E per-person ledger (ledgerEntry + allocationPreference,
 * ADR-2605181100). Balance derived by replaying owner's own E2E entries. The
 * fiat merchant-of-record settlement CALL stays etzhayyim (consent-capability).
 */
export * from "./types.js";
export {
  registerDestination,
  getDestination,
  listDestinations,
  registerRate,
  listRates,
  recordEntry,
  listEntries,
  getEntry,
  getBalance,
  setPreference,
  getPreference,
  coverage,
} from "./registry.js";
