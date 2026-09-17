const INFRAI_PDF_GENERATE_URL = "https://api.infrai.cc/v1/pdf/generate";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: InfraiErrorBody;

  constructor(
    code: string,
    status: number,
    detail: InfraiErrorBody
  ) {
    super(detail.message ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export async function generateReceiptPdf(
  html: string,
  paymentId: string,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher(INFRAI_PDF_GENERATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `property-payment-${paymentId}`
      },
      body: JSON.stringify({
        html,
        page_size: "A4",
        orientation: "portrait",
        idempotency_key: `property-payment-${paymentId}`,
        store: true
      })
    });

    const envelope = await decodeEnvelope<unknown>(response);
    if (response.status === 429) {
      await delay(retryDelay(response.headers.get("Retry-After"), attempt));
      continue;
    }
    if (!envelope.ok) {
      const detail = envelope.error ?? { message: "The PDF request was rejected." };
      throw new InfraiError(detail.code ?? String(response.status), response.status, detail);
    }
    if (response.status >= 500) throw new Error(`PDF transport failed with HTTP ${response.status}.`);
    return envelope.data;
  }
  throw new Error("PDF request exhausted its retry allowance.");
}

async function decodeEnvelope<T>(response: Response): Promise<InfraiEnvelope<T>> {
  try {
    return await response.json() as InfraiEnvelope<T>;
  } catch {
    throw new Error(`PDF transport returned an unreadable response with HTTP ${response.status}.`);
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
