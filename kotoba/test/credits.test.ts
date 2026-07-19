import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
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
} from "../src/index.js";

const OWNER = "did:web:credits.etzhayyim.com";

describe("credits kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: OWNER });
  });

  describe("allocationDestination (PLAINTEXT public catalog)", () => {
    it("registers, dedups, gets, lists/filters by role", async () => {
      expect((await registerDestination(e, { destinationId: "public-fund:common", label: "Common Fund", role: "default" })).status).toBe("registered");
      expect((await registerDestination(e, { destinationId: "public-fund:common", label: "Common Fund", role: "default" })).status).toBe("alreadyExists");
      expect((await registerDestination(e, { destinationId: "", label: "x", role: "y" })).status).toBe("rejected");
      await registerDestination(e, { destinationId: "public-fund:health-access", label: "Health Access Fund", role: "themed" });
      const got = await getDestination(e, { destinationId: "public-fund:common" });
      expect(got.destination?.label).toBe("Common Fund");
      expect((await listDestinations(e)).total).toBe(2);
      expect((await listDestinations(e, { role: "themed" })).total).toBe(1);
    });
  });

  describe("creditRate (PLAINTEXT public reference)", () => {
    it("registers decimal-string rates, rejects float-y junk, lists/filters by kind", async () => {
      expect((await registerRate(e, { rateId: "earn-hc-translation", kind: "earn", action: "hc-translation", amount: "3" })).status).toBe("registered");
      expect((await registerRate(e, { rateId: "spend-reply", kind: "spend", action: "reply", amount: "0.5" })).status).toBe("registered");
      expect((await registerRate(e, { rateId: "bad", kind: "spend", action: "x", amount: "1.2.3" })).status).toBe("rejected");
      expect((await registerRate(e, { rateId: "earn-hc-translation", kind: "earn", action: "hc-translation", amount: "3" })).status).toBe("alreadyExists");
      expect((await listRates(e)).total).toBe(2);
      expect((await listRates(e, { kind: "earn" })).total).toBe(1);
    });
  });

  describe("ledgerEntry (E2E-ENCRYPTED per-person ledger)", () => {
    it("seals via encryptedWrite, round-trips via encryptedRead, validates, derives balance", async () => {
      const u = "did:web:alice.example";
      const ok = await recordEntry(e, { entryId: "t1", userDid: u, type: "earn", amount: "100", balanceAfter: "100", source: "hc-translation" });
      expect(ok.status).toBe("recorded");
      expect(ok.keyId).toBeTruthy();
      // purchase carries an opaque etzhayyim fiat-settlement pointer (fiat rail stays etzhayyim)
      await recordEntry(e, { entryId: "t2", userDid: u, type: "purchase", amount: "70", balanceAfter: "170", source: "purchase", fiatSettlementRef: "etzhayyim-mor:pi_abc123" });
      await recordEntry(e, { entryId: "t3", userDid: u, type: "spend", amount: "-1", balanceAfter: "169", source: "post" });
      expect((await recordEntry(e, { entryId: "tX", userDid: u, type: "earn", amount: "1.0.0", balanceAfter: "1", source: "x" })).status).toBe("rejected"); // bad amount
      expect((await recordEntry(e, { entryId: "tY", userDid: u, type: "earn", amount: "1", balanceAfter: "abc", source: "x" })).status).toBe("rejected"); // bad balanceAfter

      const got = await getEntry(e, { entryId: "t2" });
      expect(got.entry?.userDid).toBe(u);
      expect(got.entry?.fiatSettlementRef).toBe("etzhayyim-mor:pi_abc123");

      expect((await listEntries(e)).total).toBe(3);
      expect((await listEntries(e, { userDid: u, type: "spend" })).total).toBe(1);

      const bal = await getBalance(e, { userDid: u });
      expect(bal.balance).toBe("169");
      expect(bal.entryCount).toBe(3);
      expect((await getBalance(e, { userDid: "did:web:nobody.example" })).balance).toBe("0");
    });

    it("enforces read-cap: a non-recipient DID cannot decrypt ledger entries", async () => {
      await recordEntry(e, { entryId: "t1", userDid: "did:web:alice.example", type: "earn", amount: "100", balanceAfter: "100", source: "hc" });
      const outsider: any = new MockEtzhayyim({ did: "did:web:outsider.example" });
      expect((await listEntries(outsider)).total).toBe(0);
      expect((await getBalance(outsider, { userDid: "did:web:alice.example" })).balance).toBe("0");
    });

    it("grants read-cap to an explicit recipient", async () => {
      const partner = "did:web:auditor.example";
      const r = await recordEntry(e, { entryId: "t1", userDid: "did:web:alice.example", type: "earn", amount: "5", balanceAfter: "5", source: "hc", recipients: [partner] });
      expect(r.status).toBe("recorded");
      expect((await listEntries(e)).total).toBe(1); // owner reads
    });
  });

  describe("allocationPreference (E2E-ENCRYPTED private config)", () => {
    it("seals, validates bps, round-trips latest preference", async () => {
      const u = "did:web:alice.example";
      const ok = await setPreference(e, { userDid: u, destinationId: "public-fund:common", title: "Common Fund", allocationBps: 1000 });
      expect(ok.status).toBe("set");
      expect((await setPreference(e, { userDid: u, destinationId: "x", title: "t", allocationBps: 20000 })).status).toBe("rejected"); // bps>10000
      // update -> latest wins
      await setPreference(e, { userDid: u, destinationId: "public-fund:health-access", title: "Health Access Fund", allocationBps: 1000 });
      const pref = await getPreference(e, { userDid: u });
      expect(pref.preference?.destinationId).toBe("public-fund:health-access");
      expect((await getPreference(e, { userDid: "did:web:nobody.example" })).error).toBe("notFound");
    });

    it("enforces read-cap on preferences", async () => {
      await setPreference(e, { userDid: "did:web:alice.example", destinationId: "public-fund:common", title: "Common Fund", allocationBps: 1000 });
      const outsider: any = new MockEtzhayyim({ did: "did:web:outsider.example" });
      expect((await getPreference(outsider, { userDid: "did:web:alice.example" })).error).toBe("notFound");
    });
  });

  describe("coverage rollup", () => {
    it("counts plaintext catalog + E2E ledger/preferences with entriesByType", async () => {
      await registerDestination(e, { destinationId: "public-fund:common", label: "Common Fund", role: "default" });
      await registerRate(e, { rateId: "earn-hc", kind: "earn", action: "hc", amount: "3" });
      await registerRate(e, { rateId: "spend-post", kind: "spend", action: "post", amount: "1" });
      await recordEntry(e, { entryId: "t1", userDid: "did:web:alice.example", type: "earn", amount: "100", balanceAfter: "100", source: "hc" });
      await recordEntry(e, { entryId: "t2", userDid: "did:web:alice.example", type: "spend", amount: "-1", balanceAfter: "99", source: "post" });
      await setPreference(e, { userDid: "did:web:alice.example", destinationId: "public-fund:common", title: "Common Fund", allocationBps: 1000 });

      const cov = await coverage(e);
      expect(cov.allocationDestinationCount).toBe(1);
      expect(cov.creditRateCount).toBe(2);
      expect(cov.ledgerEntryCount).toBe(2);
      expect(cov.allocationPreferenceCount).toBe(1);
      expect(cov.entriesByType?.earn).toBe(1);
      expect(cov.entriesByType?.spend).toBe(1);
    });
  });
});
