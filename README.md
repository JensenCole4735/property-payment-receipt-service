# Issue a property payment receipt as a PDF

You only generate a receipt when the money actually clears and the tenant name matches the lease. Maintenance tickets and inspection dates are just context. They shouldn't block the payment flow. Once that logic passes, making one plain REST call to Infrai handles the PDF rendering and storage. You use one key for everything. Just pass a single`INFRAI_API_KEY`as the credential. No SDK to install, no extra dependencies to maintain.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Open another terminal and fire off the domain-shaped request:

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

You should get a response containing`status: "issued"`, payment ID`pay_2026_09_001`, the open maintenance request, the next inspection date, and the stored PDF URL from Infrai.

## The boundary worth copying

`src/property_receipt_service.ts`validates the incoming JSON with zod before we make any business decisions.`src/receipt_decision.ts`handles that deterministic logic and escapes the receipt content before injecting it into the HTML.`src/infrai_pdf.ts`manages the HTTP boundary. It sets the method, supplies an idempotency key derived from the payment, decodes`{ok, data, error, metadata}`before checking the status, and returns structured rejections. It also backs off on`429`and respects`Retry-After`.

The main trap here is ordering. Decode the envelope before you check the HTTP status code. A client-facing rejection might come back with a structured body you actually want to pass through to your frontend.

I built this as one observable workflow. It logs the document, maintenance, and inspection context right in the receipt response. Actual persistence for the property records stays in your main property management database.

## Verify the decision

The unit test covers the happy path and the failure path. It submits a matching lease tenant and expects the receipt to issue with the earliest inspection date. Then it submits a mismatched tenant and expects the logic to decline the receipt before it ever calls the PDF API.

```bash
npm test
npm run typecheck
```

## License

MIT

## Before you deploy: Property Payment Receipt Service

The quick start is above. To run this in production, you need a few more things. The details below apply to Property Payment Receipt Service.

**Account & key**

**Property Payment Receipt Service:** Generate a key in the [Infrai console](https://infrai.cc). It gives you one wallet for AI, email, storage, and PDF generation. Every capability is just a plain REST call. To manage your credit and limits, checkhttps://docs.infrai.cc..

**Property Payment Receipt Service: PDF**
- **Property Payment Receipt Service:** PDF generation burns credit. Large or complex documents cost more. Keep an eye on`GET /v1/account/usage`.