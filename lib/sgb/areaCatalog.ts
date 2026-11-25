import { SGB_AREA_METHOD_ID, SGB_AREA_SOURCE } from "./area.ts";
import { SGB_FLOOD_LEVELS_CM, type SgbFloodLevelCm } from "./stages.ts";

export const SGB_AREA_SNAPSHOT_DATE = "2026-11-25" as const;
export const SGB_AREA_SNAPSHOT_VALIDATION_REF =
  "docs/research/SGB_AREA_VALIDATION_2026-11-25.md" as const;
export const SGB_REFERENCE_STATION_LABEL =
  "Cota de referência SGB — Pádua II (58790002)" as const;

/**
 * Tolerance used to detect area divergence between the queried geometry's derived
 * total area and the cataloged snapshot validated on 2026-11-25 (matches the 0.01%
 * policy in SGB_AREA_VALIDATION_2026-11-25.md, with a 1 m² floor).
 *
 * Note: this check compares total derived areas only; matching areas do NOT prove
 * vertex-by-vertex geometric identity.
 */
export const CATALOG_AREA_DIVERGENCE_RELATIVE_TOLERANCE = 1e-4;
export const CATALOG_AREA_DIVERGENCE_ABSOLUTE_TOLERANCE_M2 = 1.0;

export type SgbAreaSnapshotEntry = {
  readonly levelCm: SgbFloodLevelCm;
  readonly layerId: number;
  readonly layerName: `COTA_${SgbFloodLevelCm}cm`;
  readonly geojsonSha256: string;
  readonly payloadBytes: number;
  readonly areaSquareMeters: number;
  readonly areaHectares: number;
  readonly areaSquareKm: number;
  readonly karneyReferenceAreaM2: number;
  readonly rawOgcValid: boolean;
  readonly classification: "derived";
  readonly provenanceKind: "cataloged_snapshot";
  readonly snapshotDate: typeof SGB_AREA_SNAPSHOT_DATE;
  readonly method: typeof SGB_AREA_METHOD_ID;
  readonly source: typeof SGB_AREA_SOURCE;
  readonly validationRef: typeof SGB_AREA_SNAPSHOT_VALIDATION_REF;
};

type RawSnapshotSeed = {
  readonly levelCm: SgbFloodLevelCm;
  readonly layerId: number;
  readonly geojsonSha256: string;
  readonly payloadBytes: number;
  readonly areaSquareMeters: number;
  readonly karneyReferenceAreaM2: number;
  readonly rawOgcValid: boolean;
};

/**
 * Verified catalog of the 11 official SGB layers (300–550 cm) from
 * docs/research/SGB_AREA_VALIDATION_2026-11-25.md.
 *
 * Used for the interactive 11-stage area curve without issuing 11 upstream SGB
 * requests on every application open. Always kept distinct from calculations over
 * the queried geometry (which may come from HTTP/CDN cache) via `provenanceKind`
 * and area-divergence checks.
 */
const RAW_SNAPSHOT_SEEDS: readonly RawSnapshotSeed[] = [
  {
    levelCm: 300,
    layerId: 3,
    geojsonSha256:
      "100cd53b4ca6be2abf33fbefd9c0701c6765cc3bd609dead7e82cf3442be394f",
    payloadBytes: 755_946,
    areaSquareMeters: 1_706_207.16,
    karneyReferenceAreaM2: 1_706_207.161,
    rawOgcValid: true,
  },
  {
    levelCm: 325,
    layerId: 4,
    geojsonSha256:
      "d71da1ddea373ef1348037e192a94925e9b9bd5e6a0302d28f5436c355fe2fd0",
    payloadBytes: 749_198,
    areaSquareMeters: 1_748_780.085,
    karneyReferenceAreaM2: 1_748_780.087,
    rawOgcValid: true,
  },
  {
    levelCm: 350,
    layerId: 5,
    geojsonSha256:
      "5bea349d8fa0779988c26c23b9570e5e5e55136b6a24f8b00f148101906e38d8",
    payloadBytes: 772_498,
    areaSquareMeters: 1_791_640.686,
    karneyReferenceAreaM2: 1_791_640.687,
    rawOgcValid: true,
  },
  {
    levelCm: 375,
    layerId: 6,
    geojsonSha256:
      "935ba0fcf2decccf3123467512b69237abc1e3a52e39cf563faf7ca3d9873d84",
    payloadBytes: 804_229,
    areaSquareMeters: 1_841_142.021,
    karneyReferenceAreaM2: 1_841_142.021,
    rawOgcValid: true,
  },
  {
    levelCm: 400,
    layerId: 7,
    geojsonSha256:
      "1c4b1d6eada2d8f4af5101df9cdfe4b6faea8bb68b917fe6c7b78d7756711b7f",
    payloadBytes: 836_901,
    areaSquareMeters: 1_899_852.786,
    karneyReferenceAreaM2: 1_899_852.787,
    rawOgcValid: true,
  },
  {
    levelCm: 425,
    layerId: 8,
    geojsonSha256:
      "0f8121a22f2ddda9d91b16c77e27d740a47bbbba7a511186f25e13deceac09d8",
    payloadBytes: 900_266,
    areaSquareMeters: 1_967_286.602,
    karneyReferenceAreaM2: 1_967_286.604,
    rawOgcValid: true,
  },
  {
    levelCm: 450,
    layerId: 9,
    geojsonSha256:
      "1c48a29067e351f8e01da2f1b212501685ed08a6b9139c75dfe45d7e375bdaed",
    payloadBytes: 970_990,
    areaSquareMeters: 2_052_104.191,
    karneyReferenceAreaM2: 2_052_104.193,
    rawOgcValid: false,
  },
  {
    levelCm: 475,
    layerId: 10,
    geojsonSha256:
      "27fdcb7988d0ae1dbaa59ebd49201eff72a6c22880ea4b8b5146f945e41bda37",
    payloadBytes: 1_051_435,
    areaSquareMeters: 2_160_376.689,
    karneyReferenceAreaM2: 2_160_376.691,
    rawOgcValid: true,
  },
  {
    levelCm: 500,
    layerId: 11,
    geojsonSha256:
      "fd97cc0763993e68e9690980d31f73e46272a02d7c4dd4479fac2ee5caaef00a",
    payloadBytes: 1_334_540,
    areaSquareMeters: 2_310_320.715,
    karneyReferenceAreaM2: 2_310_320.713,
    rawOgcValid: true,
  },
  {
    levelCm: 525,
    layerId: 12,
    geojsonSha256:
      "c10d10e2735124632a97f1dfdcb6662663942c1ae9ec15efd32f9c21560be0a5",
    payloadBytes: 1_498_430,
    areaSquareMeters: 2_522_000.862,
    karneyReferenceAreaM2: 2_522_000.864,
    rawOgcValid: false,
  },
  {
    levelCm: 550,
    layerId: 13,
    geojsonSha256:
      "b02037c35320dd7e9bbbf00fc3c2c53ef9060987b4a1bb2462c4b86caa39daa4",
    payloadBytes: 1_437_811,
    areaSquareMeters: 2_719_339.815,
    karneyReferenceAreaM2: 2_719_339.815,
    rawOgcValid: false,
  },
];

export const SGB_AREA_SNAPSHOT_ENTRIES: readonly SgbAreaSnapshotEntry[] =
  RAW_SNAPSHOT_SEEDS.map((seed) => ({
    ...seed,
    layerName: `COTA_${seed.levelCm}cm` as `COTA_${SgbFloodLevelCm}cm`,
    areaHectares: seed.areaSquareMeters / 10_000,
    areaSquareKm: seed.areaSquareMeters / 1_000_000,
    classification: "derived",
    provenanceKind: "cataloged_snapshot",
    snapshotDate: SGB_AREA_SNAPSHOT_DATE,
    method: SGB_AREA_METHOD_ID,
    source: SGB_AREA_SOURCE,
    validationRef: SGB_AREA_SNAPSHOT_VALIDATION_REF,
  }));

export const SGB_AREA_SNAPSHOT_BY_LEVEL: Readonly<
  Record<SgbFloodLevelCm, SgbAreaSnapshotEntry>
> = Object.fromEntries(
  SGB_AREA_SNAPSHOT_ENTRIES.map((entry) => [entry.levelCm, entry]),
) as Record<SgbFloodLevelCm, SgbAreaSnapshotEntry>;

export function getSgbAreaSnapshot(
  levelCm: number,
): SgbAreaSnapshotEntry | null {
  if (!(SGB_FLOOD_LEVELS_CM as readonly number[]).includes(levelCm)) {
    return null;
  }
  return SGB_AREA_SNAPSHOT_BY_LEVEL[levelCm as SgbFloodLevelCm];
}

export type CatalogAreaDivergenceCheck = {
  readonly levelCm: SgbFloodLevelCm;
  /** True when total derived area matches the catalog within tolerance; does NOT prove geometric identity. */
  readonly matchesCatalogArea: boolean;
  readonly snapshotEntry: SgbAreaSnapshotEntry;
  readonly queriedAreaSquareMeters: number;
  readonly queriedAreaHectares: number;
  readonly diffSquareMeters: number;
  readonly diffHectares: number;
  readonly relativeDiff: number;
  readonly toleranceSquareMeters: number;
};

/**
 * Compares the derived total area of a queried geometry against the cataloged
 * 2026-11-25 snapshot area.
 *
 * Important scientific note: this verifies total-area consistency only. Equivalent
 * total areas do NOT prove vertex-by-vertex geometric identity; conversely, an
 * area divergence beyond tolerance must be surfaced explicitly rather than mixing
 * cataloged snapshot values with queried-geometry calculations.
 */
export function checkCatalogAreaDivergence(
  levelCm: SgbFloodLevelCm,
  queriedAreaSquareMeters: number,
): CatalogAreaDivergenceCheck {
  const snapshotEntry = SGB_AREA_SNAPSHOT_BY_LEVEL[levelCm];
  const diffSquareMeters =
    queriedAreaSquareMeters - snapshotEntry.areaSquareMeters;
  const absDiff = Math.abs(diffSquareMeters);
  const toleranceSquareMeters = Math.max(
    CATALOG_AREA_DIVERGENCE_ABSOLUTE_TOLERANCE_M2,
    CATALOG_AREA_DIVERGENCE_RELATIVE_TOLERANCE * snapshotEntry.areaSquareMeters,
  );
  const relativeDiff =
    snapshotEntry.areaSquareMeters > 0
      ? absDiff / snapshotEntry.areaSquareMeters
      : Infinity;

  return {
    levelCm,
    matchesCatalogArea: absDiff <= toleranceSquareMeters,
    snapshotEntry,
    queriedAreaSquareMeters,
    queriedAreaHectares: queriedAreaSquareMeters / 10_000,
    diffSquareMeters,
    diffHectares: diffSquareMeters / 10_000,
    relativeDiff,
    toleranceSquareMeters,
  };
}
