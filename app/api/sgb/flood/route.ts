import { NextRequest, NextResponse } from "next/server";
import {
  fetchSgbFloodLayer,
  isSgbFloodLevelCm,
} from "@/lib/sgb/flood";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rawLevel = request.nextUrl.searchParams.get("level");
  const levelCm = Number(rawLevel);

  if (!Number.isInteger(levelCm) || !isSgbFloodLevelCm(levelCm)) {
    return NextResponse.json(
      {
        error: "unsupported_level",
        message: "Use uma cota oficial SGB entre 300 e 550 cm, em passos de 25 cm.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await fetchSgbFloodLayer(levelCm);

    return NextResponse.json(
      {
        classification: "official_reference",
        provider: "Serviço Geológico do Brasil",
        levelCm: result.levelCm,
        layerId: result.layerId,
        layerName: result.layerName,
        geojson: result.geojson,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load SGB flood layer", error);

    return NextResponse.json(
      {
        error: "upstream_unavailable",
        message: "Não foi possível obter a mancha oficial do SGB neste momento.",
      },
      { status: 502 },
    );
  }
}
