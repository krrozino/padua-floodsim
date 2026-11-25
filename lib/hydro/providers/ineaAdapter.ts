import https from "node:https";
import { INEA_PADUA_STATION_ID, INEA_PADUA_XML_URL } from "../ineaParser.ts";
import { getVerifiedIneaCaBundle } from "./ineaTlsChain.ts";

export const ALLOWED_INEA_HOSTS = new Set(["alertadecheias.inea.rj.gov.br"]);
export const INEA_FETCH_TIMEOUT_MS = 12_000;
export const INEA_MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MiB safety cap
export const INEA_RETRY_DELAY_MS = 400;
const MAX_REDIRECTS = 3;

export type RawProviderFetchResult =
  | {
      kind: "ok";
      xml: string;
      etag?: string;
      lastModified?: string;
      byteLength: number;
    }
  | {
      kind: "not_modified";
      etag?: string;
      lastModified?: string;
    };

export interface HydroProviderAdapter {
  readonly providerId: "inea";
  readonly stationId: string;
  readonly sourceUrl: string;
  fetchRawPayload(options?: {
    ifNoneMatch?: string;
    ifModifiedSince?: string;
    signal?: AbortSignal;
  }): Promise<RawProviderFetchResult>;
}

export interface IneaAdapterOptions {
  sourceUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  retryDelayMs?: number;
}

interface HttpPayloadResponse {
  status: number;
  etag?: string;
  lastModified?: string;
  text: string;
  byteLength: number;
}

export function assertAllowedIneaUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:") {
    throw new Error(`Protocolo não permitido para fonte INEA: ${parsed.protocol}`);
  }
  if (!ALLOWED_INEA_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host não autorizado para fonte INEA: ${parsed.hostname}`);
  }
  return parsed;
}

async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; byteLength: number }> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const declaredBytes = Number(contentLengthHeader);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new Error(
        `Payload INEA excede limite declarado (${declaredBytes} > ${maxBytes} bytes).`,
      );
    }
  }

  if (!response.body) {
    const fallbackText = await response.text();
    const byteLength = Buffer.byteLength(fallbackText, "utf8");
    if (byteLength > maxBytes) {
      throw new Error(
        `Payload INEA excede limite de tamanho (${byteLength} > ${maxBytes} bytes).`,
      );
    }
    return { text: fallbackText, byteLength };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("Payload exceeds maximum allowed size");
        throw new Error(
          `Payload INEA excede limite durante leitura (${totalBytes} > ${maxBytes} bytes).`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = Buffer.concat(chunks, totalBytes);
  return {
    text: combined.toString("utf8"),
    byteLength: totalBytes,
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function combineSignals(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, externalSignal]);
  }
  return timeoutSignal;
}

function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}

async function httpsGetIneaWithStrictTls(
  initialUrl: URL,
  options: {
    headers: Record<string, string>;
    timeoutMs: number;
    maxBytes: number;
    signal?: AbortSignal;
  },
): Promise<HttpPayloadResponse> {
  const caBundle = getVerifiedIneaCaBundle() as string[];
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertAllowedIneaUrl(currentUrl.toString());

    const result = await new Promise<
      | { kind: "redirect"; location: string }
      | { kind: "response"; data: HttpPayloadResponse }
    >((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }

      let settled = false;
      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const req = https.request(
        currentUrl,
        {
          method: "GET",
          headers: options.headers,
          ca: caBundle,
          rejectUnauthorized: true,
        },
        (res) => {
          const status = res.statusCode ?? 0;

          if (isRedirectStatus(status)) {
            const location = res.headers.location;
            res.resume();
            if (!location) {
              fail(new Error(`Redirect HTTP ${status} sem cabeçalho Location.`));
              return;
            }
            const nextUrl = new URL(location, currentUrl);
            try {
              assertAllowedIneaUrl(nextUrl.toString());
            } catch (allowError) {
              fail(allowError);
              return;
            }
            settled = true;
            resolve({ kind: "redirect", location: nextUrl.toString() });
            return;
          }

          const contentLengthHeader = res.headers["content-length"];
          if (typeof contentLengthHeader === "string") {
            const declaredBytes = Number(contentLengthHeader);
            if (Number.isFinite(declaredBytes) && declaredBytes > options.maxBytes) {
              res.destroy();
              fail(
                new Error(
                  `Payload INEA excede limite declarado (${declaredBytes} > ${options.maxBytes} bytes).`,
                ),
              );
              return;
            }
          }

          const chunks: Buffer[] = [];
          let totalBytes = 0;

          res.on("data", (chunk: Buffer) => {
            totalBytes += chunk.byteLength;
            if (totalBytes > options.maxBytes) {
              res.destroy();
              fail(
                new Error(
                  `Payload INEA excede limite durante leitura (${totalBytes} > ${options.maxBytes} bytes).`,
                ),
              );
              return;
            }
            chunks.push(chunk);
          });

          res.on("end", () => {
            if (settled) return;
            settled = true;
            const combined = Buffer.concat(chunks, totalBytes);
            const etagHeader = res.headers.etag;
            const lastModifiedHeader = res.headers["last-modified"];
            resolve({
              kind: "response",
              data: {
                status,
                etag: typeof etagHeader === "string" ? etagHeader : undefined,
                lastModified:
                  typeof lastModifiedHeader === "string"
                    ? lastModifiedHeader
                    : undefined,
                text: combined.toString("utf8"),
                byteLength: totalBytes,
              },
            });
          });

          res.on("error", fail);
        },
      );

      req.setTimeout(options.timeoutMs, () => {
        req.destroy(new DOMException("The operation timed out.", "TimeoutError"));
      });

      const onAbort = () => {
        req.destroy(new DOMException("The operation was aborted.", "AbortError"));
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });

      req.on("error", (err) => {
        options.signal?.removeEventListener("abort", onAbort);
        fail(err);
      });
      req.on("close", () => {
        options.signal?.removeEventListener("abort", onAbort);
      });

      req.end();
    });

    if (result.kind === "redirect") {
      currentUrl = assertAllowedIneaUrl(result.location);
      continue;
    }

    return result.data;
  }

  throw new Error("Excesso de redirecionamentos ao consultar a fonte INEA.");
}

async function fetchViaInjectedFetch(
  fetchImpl: typeof fetch,
  targetUrl: URL,
  options: {
    headers: Record<string, string>;
    timeoutMs: number;
    maxBytes: number;
    signal?: AbortSignal;
  },
): Promise<HttpPayloadResponse> {
  const response = await fetchImpl(targetUrl.toString(), {
    method: "GET",
    headers: options.headers,
    signal: combineSignals(options.timeoutMs, options.signal),
    cache: "no-store",
    redirect: "follow",
  });

  if (response.url) {
    assertAllowedIneaUrl(response.url);
  }

  if (response.status === 304 || !response.ok) {
    return {
      status: response.status,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
      text: "",
      byteLength: 0,
    };
  }

  const { text, byteLength } = await readResponseTextWithLimit(
    response,
    options.maxBytes,
  );

  return {
    status: response.status,
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
    text,
    byteLength,
  };
}

export function createIneaAdapter(
  options: IneaAdapterOptions = {},
): HydroProviderAdapter {
  const sourceUrl = options.sourceUrl ?? INEA_PADUA_XML_URL;
  assertAllowedIneaUrl(sourceUrl);

  const injectedFetch = options.fetchImpl;
  const timeoutMs = options.timeoutMs ?? INEA_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? INEA_MAX_PAYLOAD_BYTES;
  const retryDelayMs = options.retryDelayMs ?? INEA_RETRY_DELAY_MS;

  return {
    providerId: "inea",
    stationId: INEA_PADUA_STATION_ID,
    sourceUrl,
    async fetchRawPayload(fetchOptions = {}): Promise<RawProviderFetchResult> {
      const targetUrl = assertAllowedIneaUrl(sourceUrl);
      const headers: Record<string, string> = {
        Accept: "application/xml, text/xml;q=0.9",
        "User-Agent":
          "PaduaFloodSim/0.1 (Academic Research; +https://github.com/krrozino/padua-floodsim)",
      };

      if (fetchOptions.ifNoneMatch) {
        headers["If-None-Match"] = fetchOptions.ifNoneMatch;
      }
      if (fetchOptions.ifModifiedSince) {
        headers["If-Modified-Since"] = fetchOptions.ifModifiedSince;
      }

      let lastError: unknown;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const res = injectedFetch
            ? await fetchViaInjectedFetch(injectedFetch, targetUrl, {
                headers,
                timeoutMs,
                maxBytes,
                signal: fetchOptions.signal,
              })
            : await httpsGetIneaWithStrictTls(targetUrl, {
                headers,
                timeoutMs,
                maxBytes,
                signal: fetchOptions.signal,
              });

          if (res.status === 304) {
            return {
              kind: "not_modified",
              etag: res.etag,
              lastModified: res.lastModified,
            };
          }

          if (res.status < 200 || res.status >= 300) {
            if (attempt === 0 && isRetryableStatus(res.status)) {
              lastError = new Error(`INEA HTTP ${res.status}`);
              await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
              continue;
            }
            throw new Error(`INEA HTTP ${res.status}`);
          }

          return {
            kind: "ok",
            xml: res.text,
            etag: res.etag,
            lastModified: res.lastModified,
            byteLength: res.byteLength,
          };
        } catch (error) {
          lastError = error;
          const message =
            error instanceof Error ? error.message : String(error);
          const nonRetryable =
            message.includes("não permitido") ||
            message.includes("não autorizado") ||
            message.includes("excede limite") ||
            message.startsWith("INEA HTTP 4");

          if (attempt === 0 && !nonRetryable && !fetchOptions.signal?.aborted) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
          throw error;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new Error("Falha ao consultar o XML do INEA.");
    },
  };
}
