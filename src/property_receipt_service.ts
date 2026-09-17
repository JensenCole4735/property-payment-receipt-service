import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { decideReceipt, paymentReceiptSchema, receiptHtml } from "./receipt_decision.js";
import { generateReceiptPdf, InfraiError } from "./infrai_pdf.js";

const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/receipts") {
    return send(response, 404, { error: "Route not found" });
  }

  try {
    const input = paymentReceiptSchema.parse(await readJson(request));
    const decision = decideReceipt(input);
    if (decision.issue === false) return send(response, 422, { error: decision.reason });

    const pdf = await generateReceiptPdf(receiptHtml(decision), input.paymentId);
    return send(response, 201, {
      paymentId: input.paymentId,
      status: "issued",
      openMaintenanceCount: decision.openMaintenanceCount,
      nextInspectionDue: decision.nextInspectionDue,
      pdf
    });
  } catch (error) {
    if (error instanceof ZodError) return send(response, 400, { error: "Invalid receipt request", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.message, code: error.code });
    }
    return send(response, 502, { error: error instanceof Error ? error.message : "Receipt generation failed" });
  }
}).listen(port, () => console.log(`Property receipt service listening on http://localhost:${port}`));

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
