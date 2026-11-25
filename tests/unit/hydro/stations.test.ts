import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HYDRO_STATIONS,
  PLOTTED_HYDRO_STATIONS,
  buildHydroStationsGeoJSON,
} from "../../../lib/hydro/stations.ts";

describe("Verified hydrological stations metadata and map layer", () => {
  it("plots only stations with confirmed WGS84 coordinates and omits RHN 58790002 due to divergence", () => {
    assert.equal(HYDRO_STATIONS.length, 3);
    assert.equal(PLOTTED_HYDRO_STATIONS.length, 2);

    const ids = PLOTTED_HYDRO_STATIONS.map((s) => s.id);
    assert.deepEqual(ids, ["inea-213042120", "inea-58789000"]);

    const paduaII = HYDRO_STATIONS.find((s) => s.id === "rhn-58790002");
    assert.ok(paduaII);
    assert.equal(paduaII.plotOnMap, false);
    assert.equal(paduaII.coordinates, null);
    assert.match(paduaII.locationDescription, /divergentes/i);
  });

  it("builds valid WGS84 GeoJSON Point features with provenance and official links", () => {
    const fc = buildHydroStationsGeoJSON();
    assert.equal(fc.type, "FeatureCollection");
    assert.equal(fc.features.length, 2);

    const [paduaInea, paraoquena] = fc.features;
    assert.deepEqual(paduaInea.geometry.coordinates, [-42.20767, -21.51122]);
    assert.equal(paduaInea.properties?.classification, "official_reference");
    assert.match(String(paduaInea.properties?.identifiers), /213042120/);
    assert.match(String(paduaInea.properties?.identifiers), /58774000/);
    assert.equal(paduaInea.properties?.hasLiveIntegration, true);

    assert.deepEqual(paraoquena.geometry.coordinates, [-42.25336, -21.49539]);
    assert.equal(paraoquena.properties?.classification, "official_reference");
    assert.match(String(paraoquena.properties?.identifiers), /58789000/);
    assert.equal(paraoquena.properties?.hasLiveIntegration, false);
  });
});
