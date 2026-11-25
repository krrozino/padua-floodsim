import { NextRequest, NextResponse } from "next/server";
import { validateHydroMonitoringResponse } from "@/lib/hydro/contract";
import { INEA_PADUA_STATION_ID } from "@/lib/hydro/ineaParser";
import { hydroMonitoringService } from "@/lib/hydro/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const providerParam = request.nextUrl.searchParams.get("provider");
  const stationParam = request.nextUrl.searchParams.get("station");
  const refreshParam = request.nextUrl.searchParams.get("refresh");

  if (providerParam !== null && providerParam !== "inea") {
    return NextResponse.json(
      {
        error: "unsupported_provider",
        message: "Provedor hidrológico não suportado. Utilize provider=inea.",
      },
      { status: 400 },
    );
  }

  if (stationParam !== null && stationParam !== INEA_PADUA_STATION_ID) {
    return NextResponse.json(
      {
        error: "unsupported_station",
        message: `Estação hidrológica não suportada. Utilize station=${INEA_PADUA_STATION_ID}.`,
      },
      { status: 400 },
    );
  }

  const observation = await hydroMonitoringService.getLatestObservation({
    forceRefresh: refreshParam === "1",
  });

  if (!validateHydroMonitoringResponse(observation)) {
    return NextResponse.json(
      {
        error: "invalid_observation_contract",
        message:
          "Falha interna de validação do contrato de observação hidrológica.",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const httpStatus =
    observation.status === "unavailable"
      ? 503
      : observation.status === "invalid"
        ? 502
        : 200;

  return NextResponse.json(observation, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
