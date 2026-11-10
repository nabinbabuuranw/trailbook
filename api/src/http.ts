export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export function withSecurityHeaders(res: Response, isApi: boolean): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  if (isApi) headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(headers || {}) },
  });
}

export function errorResponse(err: ApiError): Response {
  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code: err.code, message: err.message },
  };
  if (err.details !== undefined) body.error.details = err.details;
  return json(body, err.status);
}

/** Reads a JSON body with a size limit. Rejects non-JSON content types and oversize bodies. */
export async function readJson(req: Request, limitBytes = 8192): Promise<Record<string, unknown>> {
  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Send the request as JSON.');
  }
  const declared = Number(req.headers.get('content-length') || '0');
  if (declared > limitBytes) throw new ApiError(413, 'payload_too_large', 'The request is too large.');
  const text = await req.text();
  if (new TextEncoder().encode(text).length > limitBytes) {
    throw new ApiError(413, 'payload_too_large', 'The request is too large.');
  }
  if (text.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError(400, 'invalid_body', 'The request body must be an object.');
  }
  return parsed as Record<string, unknown>;
}

// Typed field readers: every write goes through these, so validation lives in one place.
export function str(body: Record<string, unknown>, key: string, opts: { min?: number; max: number; optional?: boolean }): string | null {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return null;
    throw new ApiError(400, 'invalid_input', `${key} is required.`, { field: key });
  }
  if (typeof v !== 'string') throw new ApiError(400, 'invalid_input', `${key} must be text.`, { field: key });
  const t = v.trim();
  if (t.length === 0 && !opts.optional) throw new ApiError(400, 'invalid_input', `${key} is required.`, { field: key });
  if (opts.min !== undefined && t.length < opts.min) {
    throw new ApiError(400, 'invalid_input', `${key} must be at least ${opts.min} characters.`, { field: key });
  }
  if (t.length > opts.max) throw new ApiError(400, 'invalid_input', `${key} must be at most ${opts.max} characters.`, { field: key });
  return t.length ? t : null;
}

export function int(body: Record<string, unknown>, key: string, min: number, max: number): number {
  const v = body[key];
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new ApiError(400, 'invalid_input', `${key} must be a whole number.`, { field: key });
  if (v < min || v > max) throw new ApiError(400, 'invalid_input', `${key} must be between ${min} and ${max}.`, { field: key });
  return v;
}

export function bool(body: Record<string, unknown>, key: string): boolean {
  const v = body[key];
  if (typeof v !== 'boolean') throw new ApiError(400, 'invalid_input', `${key} must be true or false.`, { field: key });
  return v;
}

export function oneOf<T extends string>(body: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const v = body[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new ApiError(400, 'invalid_input', `${key} must be one of: ${allowed.join(', ')}.`, { field: key });
  }
  return v as T;
}
