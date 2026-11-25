import { X509Certificate } from "node:crypto";
import tls from "node:tls";

/**
 * Expected SHA-256 fingerprint of the official Sectigo intermediate CA:
 * `Sectigo Public Server Authentication CA DV R36`
 *
 * Official Sectigo publication:
 * - Download: http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt
 * - crt.sh: https://crt.sh/?d=4267304690
 * - Issuer: `Sectigo Public Server Authentication Root R46` (built into Node.js `tls.rootCertificates`)
 * - Serial: `397A66CC2756362E0DAA87CA6EABE3B1`
 * - Validity: `2021-03-22T00:00:00Z` to `2036-03-21T23:59:59Z`
 *
 * Why this intermediate is bundled:
 * `alertadecheias.inea.rj.gov.br` omits this intermediate certificate during its TLS handshake,
 * causing Node.js (which does not perform AIA chasing) to fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
 *
 * Trust boundary:
 * We NEVER trust this certificate as a root or disable TLS validation.
 * `getVerifiedIneaCaBundle()` verifies:
 * 1. `ca === true` (Basic Constraints CA flag);
 * 2. exact SHA-256 fingerprint match;
 * 3. certificate validity period (`validFrom <= now <= validTo`);
 * 4. cryptographic signature against a currently valid built-in Node.js root CA.
 *
 * Renewal / maintenance procedure:
 * - If INEA renews its leaf certificate under the same Sectigo DV R36 intermediate: no code change needed.
 * - If INEA fixes its server to send the complete chain: `ineaTlsChain.ts` can be removed after confirming
 *   `npm run smoke:hydro` passes using Node's default trust store.
 * - If INEA migrates to a different CA/intermediate that is also omitted in the handshake:
 *   obtain the public intermediate exclusively from the issuing CA's official repository, verify its
 *   signature against `tls.rootCertificates`, update the PEM and expected fingerprint below, document the
 *   rotation in `docs/DATA_SOURCES.md`, and re-run unit tests and `npm run smoke:hydro`.
 */
export const SECTIGO_DV_R36_METADATA = {
  subjectCn: "Sectigo Public Server Authentication CA DV R36",
  issuerCn: "Sectigo Public Server Authentication Root R46",
  serialNumber: "397A66CC2756362E0DAA87CA6EABE3B1",
  validFromIso: "2021-03-22T00:00:00Z",
  validToIso: "2036-03-21T23:59:59Z",
  fingerprint256:
    "8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0",
  officialDownloadUrl:
    "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt",
} as const;

export const SECTIGO_DV_R36_INTERMEDIATE_PEM = [
  "-----BEGIN CERTIFICATE-----",
  "MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf",
  "MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD",
  "Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw",
  "HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY",
  "MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp",
  "YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B",
  "AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq",
  "RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH",
  "12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja",
  "EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm",
  "M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv",
  "38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB",
  "pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn",
  "2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN",
  "xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk",
  "lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw",
  "DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI",
  "KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw",
  "VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv",
  "UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH",
  "AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp",
  "Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF",
  "BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA",
  "YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8",
  "ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d",
  "q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF",
  "h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH",
  "5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD",
  "4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd",
  "unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536",
  "WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l",
  "7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW",
  "r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh",
  "JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=",
  "-----END CERTIFICATE-----",
].join("\n");

function isWithinCertificateValidity(cert: X509Certificate, nowMs: number): boolean {
  const fromMs = Date.parse(cert.validFrom);
  const toMs = Date.parse(cert.validTo);
  return Number.isFinite(fromMs) && Number.isFinite(toMs) && nowMs >= fromMs && nowMs <= toMs;
}

let cachedBundle: ReadonlyArray<string> | null = null;
let cachedBundleValidUntilMs = 0;

/**
 * Verifies the bundled Sectigo DV R36 intermediate certificate against Node's
 * built-in root trust store, expected SHA-256 fingerprint, and validity window.
 */
export function verifyIneaIntermediateCertificate(
  referenceDate: Date = new Date(),
): {
  fingerprint256: string;
  validFrom: string;
  validTo: string;
  issuer: string;
} {
  const nowMs = referenceDate.getTime();
  const intermediateCert = new X509Certificate(SECTIGO_DV_R36_INTERMEDIATE_PEM);

  if (!intermediateCert.ca) {
    throw new Error("Certificado intermediário Sectigo inválido (não é CA).");
  }

  if (intermediateCert.fingerprint256 !== SECTIGO_DV_R36_METADATA.fingerprint256) {
    throw new Error(
      "Fingerprint SHA-256 do certificado intermediário Sectigo não corresponde ao valor auditado.",
    );
  }

  if (!isWithinCertificateValidity(intermediateCert, nowMs)) {
    throw new Error(
      `Certificado intermediário Sectigo fora da janela de validade (${intermediateCert.validFrom} — ${intermediateCert.validTo}).`,
    );
  }

  const verifiedByBuiltInRoot = tls.rootCertificates.some((rootPem) => {
    try {
      const rootCert = new X509Certificate(rootPem);
      return (
        rootCert.subject === intermediateCert.issuer &&
        isWithinCertificateValidity(rootCert, nowMs) &&
        intermediateCert.verify(rootCert.publicKey)
      );
    } catch {
      return false;
    }
  });

  if (!verifiedByBuiltInRoot) {
    throw new Error(
      "Certificado intermediário Sectigo não pôde ser verificado contra a raiz confiável do Node.",
    );
  }

  return {
    fingerprint256: intermediateCert.fingerprint256,
    validFrom: intermediateCert.validFrom,
    validTo: intermediateCert.validTo,
    issuer: intermediateCert.issuer,
  };
}

/**
 * Returns Node's built-in root CA list augmented with the Sectigo DV R36 intermediate CA
 * after verifying its fingerprint, validity window, and signature against a built-in Node root CA.
 */
export function getVerifiedIneaCaBundle(
  referenceDate?: Date,
): ReadonlyArray<string> {
  const now = referenceDate ?? new Date();
  const nowMs = now.getTime();

  if (!referenceDate && cachedBundle && nowMs <= cachedBundleValidUntilMs) {
    return cachedBundle;
  }

  const verified = verifyIneaIntermediateCertificate(now);
  const bundle = [...tls.rootCertificates, SECTIGO_DV_R36_INTERMEDIATE_PEM];

  if (!referenceDate) {
    cachedBundle = bundle;
    cachedBundleValidUntilMs = Date.parse(verified.validTo);
  }

  return bundle;
}
