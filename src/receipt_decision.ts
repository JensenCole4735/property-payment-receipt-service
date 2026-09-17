import { z } from "zod";

const maintenanceRequestSchema = z.object({
  summary: z.string().min(1),
  status: z.enum(["open", "scheduled", "resolved"]),
  priority: z.enum(["routine", "urgent"])
});

const tenantDocumentSchema = z.object({
  kind: z.enum(["lease", "insurance", "identity"]),
  tenantName: z.string().min(1),
  reference: z.string().min(1)
});

const inspectionReminderSchema = z.object({
  dueOn: z.iso.date(),
  note: z.string().min(1)
});

export const paymentReceiptSchema = z.object({
  paymentId: z.string().min(1),
  propertyName: z.string().min(1),
  unit: z.string().min(1),
  tenantName: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paidOn: z.iso.date(),
  maintenanceRequests: z.array(maintenanceRequestSchema),
  tenantDocuments: z.array(tenantDocumentSchema),
  inspectionReminders: z.array(inspectionReminderSchema)
});

export type PaymentReceiptInput = z.infer<typeof paymentReceiptSchema>;

export type ReceiptDecision =
  | { issue: true; input: PaymentReceiptInput; openMaintenanceCount: number; nextInspectionDue: string | null }
  | { issue: false; reason: string };

export function decideReceipt(input: PaymentReceiptInput): ReceiptDecision {
  const lease = input.tenantDocuments.find((document) => document.kind === "lease");
  if (!lease) return { issue: false, reason: "A lease document is required before issuing a receipt." };
  if (lease.tenantName !== input.tenantName) {
    return { issue: false, reason: "The payment tenant must match the lease document tenant." };
  }

  const nextInspectionDue = input.inspectionReminders
    .map((reminder) => reminder.dueOn)
    .sort()[0] ?? null;

  return {
    issue: true,
    input,
    openMaintenanceCount: input.maintenanceRequests.filter((request) => request.status !== "resolved").length,
    nextInspectionDue
  };
}

export function receiptHtml(decision: Extract<ReceiptDecision, { issue: true }>): string {
  const payment = decision.input;
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: payment.currency
  }).format(payment.amountCents / 100);
  const inspection = decision.nextInspectionDue ?? "None scheduled";

  return `<!doctype html><html><body><h1>Payment receipt</h1><dl><dt>Payment</dt><dd>${escapeHtml(payment.paymentId)}</dd><dt>Property</dt><dd>${escapeHtml(payment.propertyName)}, unit ${escapeHtml(payment.unit)}</dd><dt>Tenant</dt><dd>${escapeHtml(payment.tenantName)}</dd><dt>Paid</dt><dd>${escapeHtml(amount)} on ${escapeHtml(payment.paidOn)}</dd><dt>Open maintenance requests</dt><dd>${decision.openMaintenanceCount}</dd><dt>Next inspection</dt><dd>${escapeHtml(inspection)}</dd></dl></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] as string);
}
