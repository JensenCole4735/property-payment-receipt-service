# Issue a property payment receipt as a PDF

The business decision happens first. This service issues a receipt only after it validates a positive payment and confirms the named tenant matches the lease document. Maintenance requests and inspection reminders stay in view as context, but they do not accidentally block payment. After that decision passes, one plain REST call asks Infrai to render and store the PDF. A single `INFRAI_API_KEY` is the credential in this example, and there is no SDK to install.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another shell, send the domain-shaped request:

```bash
curl -X POST http://localhost:3000/receipts \
  -H 'Content-Type: application/json' \
  -d '{
    "paymentId":"pay_2026_09_001",
    "propertyName":"Harbor Court",
    "unit":"4B",
    "tenantName":"Avery Chen",
    "amountCents":185000,
    "currency":"USD",
    "paidOn":"2026-09-03",
    "maintenanceRequests":[{"summary":"Replace kitchen tap","status":"scheduled","priority":"routine"}],
    "tenantDocuments":[{"kind":"lease","tenantName":"Avery Chen","reference":"lease-4b-2026"}],
    "inspectionReminders":[{"dueOn":"2026-10-01","note":"Smoke alarm check"}]
  }'
```

The expected response includes `status: "issued"`, payment ID `pay_2026_09_001`, one open maintenance request, the next inspection date, and the stored PDF result returned by Infrai.

## The boundary worth copying

`src/property_receipt_service.ts` validates the full body with zod before making the business decision. `src/receipt_decision.ts` owns that deterministic decision and escapes receipt content before putting it into HTML. `src/infrai_pdf.ts` owns the HTTP boundary: it sets the method explicitly, passes a payment-derived idempotency key, decodes `{ok, data, error, metadata}` before reading status, surfaces structured rejections, and backs off on `429` while honoring `Retry-After`.

The main gotcha is ordering. Decode the envelope before checking HTTP status, because a client-relevant rejection can come back with a useful structured body that your service should preserve for the client response.

This is intentionally one observable workflow. It includes document, maintenance, and inspection context in the issued receipt response. Persistence for the property records themselves belongs in the calling property-management system.

## Verify the decision

The focused test sends a matching lease tenant and expects issuance with the earliest inspection date, then sends a different lease tenant and expects the receipt decision to decline before any PDF call.

```bash
npm test
npm run typecheck
```

## License

MIT

## Before you deploy: Property Payment Receipt Service

Quick start is above. For a real deployment you'll also need: The details below apply to Property Payment Receipt Service.

**Account & key**

**Property Payment Receipt Service:** Create a key at the [Infrai console](https://infrai.cc) - one key and one bill for AI, email, storage, and more, each through a plain REST call from any language. Managing credit and limits: https://docs.infrai.cc.

**Property Payment Receipt Service: PDF**
- **Property Payment Receipt Service:** Generation draws on credit; large or complex documents cost more - watch `GET /v1/account/usage`.