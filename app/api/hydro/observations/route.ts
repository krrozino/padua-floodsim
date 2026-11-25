import { NextRequest, NextResponse } from "next/server";
import { validateHydroMonitoringResponse } from "@/lib/hydro/contract";
import {
  buildHydroCacheControlHeader,
  validateHydroQueryParams,
} from "@/lib/hydro/httpPolicy";
import { hydroMonitoringService } from "@/lib/hydro/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const queryCheck = validateHydroQueryParams(request.nextUrl.searchParams);
  if (!queryCheck.ok) {
    return NextResponse.json(
      {
        error: queryCheck.error,
        message: queryCheck.message,
      },
      {
        status: queryCheck.status,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const observation = await hydroMonitoringService.getLatestObservation();

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

  const cacheControl =
    httpStatus === 200 ? buildHydroCacheControlHeader(observation) : "no-store";

  return NextResponse.json(observation, {
    status: httpStatus,
    headers: {
      "Cache-Control": cacheControl,
      Vary: "Accept-Encoding",
    },
  });
}
