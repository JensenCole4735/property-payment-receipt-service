import assert from "node:assert/strict";
import test from "node:test";
import { decideReceipt, paymentReceiptSchema } from "../src/receipt_decision.js";

const payment = {
  paymentId: "pay_2026_09_001",
  propertyName: "Harbor Court",
  unit: "4B",
  tenantName: "Avery Chen",
  amountCents: 185000,
  currency: "USD",
  paidOn: "2026-09-03",
  maintenanceRequests: [
    { summary: "Replace kitchen tap", status: "scheduled", priority: "routine" }
  ],
  tenantDocuments: [
    { kind: "lease", tenantName: "Avery Chen", reference: "lease-4b-2026" }
  ],
  inspectionReminders: [
    { dueOn: "2026-12-15", note: "Annual safety inspection" },
    { dueOn: "2026-10-01", note: "Smoke alarm check" }
  ]
};

test("issues a receipt and selects the next inspection for the matching lease tenant", () => {
  const decision = decideReceipt(paymentReceiptSchema.parse(payment));
  assert.equal(decision.issue, true);
  if (decision.issue) {
    assert.equal(decision.openMaintenanceCount, 1);
    assert.equal(decision.nextInspectionDue, "2026-10-01");
  }
});

test("declines issuance when the lease belongs to another tenant", () => {
  const input = paymentReceiptSchema.parse({
    ...payment,
    tenantDocuments: [{ kind: "lease", tenantName: "Morgan Lee", reference: "lease-4b-2026" }]
  });
  assert.deepEqual(decideReceipt(input), {
    issue: false,
    reason: "The payment tenant must match the lease document tenant."
  });
});
