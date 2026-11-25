# Validação Numérica Independente — Área Derivada das 11 Manchas SGB (25/11/2026)

**Status:** Validação executada em ambiente CLOUD sobre os 11 payloads GeoJSON oficiais consultados diretamente do Geoportal SGB em 25/11/2026.  
**Escopo:** Fechamento da métrica espacial derivada (`derived`) da Sprint R02-B (PR #48 / Issue #21).  
**Aviso:** Os valores abaixo representam a área horizontal dos polígonos estáticos de referência do SGB (2024), nunca área efetivamente inundada no momento, profundidade ou risco.

## 1. Origem, CRS e versões das bibliotecas

- **Serviço de origem:** `https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer/{layerId}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson`
- **CRS nativo do serviço:** `EPSG:4674` (SIRGAS 2000), exportado pelo próprio MapServer em `EPSG:4326` (`outSR=4326`).
- **Método avaliado (TypeScript — `lib/sgb/area.ts`, `wgs84-ellipsoidal-geodesic-union-v1`):**
  - Falha fechada em qualquer geometria, parte de `MultiPolygon`, anel interno (buraco) ou anel degenerado/colinear inválido (sem descarte silencioso).
  - Normalização topológica permitida: remoção de vértices consecutivos duplicados, fechamento de anel aberto com >= 3 vértices finitos distintos e união topológica via `polygon-clipping@0.15.7` (que dissolve sobreposições e resolve pontos de autotoque de polígonos derivados de raster).
  - Integração: **aproximação numérica** por regra trapezoidal em latitude autálica no elipsoide WGS84.
  - Ambiente: `Node.js v22.23.5`, `polygon-clipping 0.15.7`.
- **Referência independente 1 (Geodésica WGS84 exata — Karney):**
  - `Python 3.12.16`, `pyproj 3.8.0`, `shapely 2.2.0`.
  - Mesmo GeoJSON (`EPSG:4326`), verificado por SHA-256; política topológica equivalente (`make_valid` quando necessário + `shapely.union_all`); área por `pyproj.Geod(ellps="WGS84").geometry_area_perimeter(...)`.
- **Referência independente 2 (Projeção métrica SIRGAS 2000 / UTM 23S — `EPSG:31983`):**
  - Transformação `pyproj.Transformer.from_crs("EPSG:4326", "EPSG:31983", always_xy=True)` sobre a mesma geometria unificada (`shapely.union_all`) e área planar euclidiana.

## 2. Política de tolerância justificada

1. **Contra `pyproj.Geod(ellps="WGS84")` (Karney):** tolerância máxima admissível de **0,01%** (`1e-4`), compatível com a diferença entre aproximação numérica trapezoidal em latitude autálica e integração geodésica elipsoidal exata em segmentos curtos (~10 m). **Máximo observado: `0,003 m²` (`< 0,000001%`).**
2. **Contra `EPSG:31983` (UTM 23S planar):** diferença esperada de aproximadamente `-0,131%` devido ao fator de escala da projeção Transversa de Mercator ($k_0 = 0{,}9996$, meridiano central $-45{,}0^\circ$, longitude local $\approx -42{,}18^\circ \Rightarrow k^2 - 1 \approx +0{,}001313$). **Máximo observado: `-0,131329%` (totalmente explicado pela distorção de escala UTM).**

## 3. Achados de validade topológica nas camadas brutas SGB

- 8 camadas (`300`, `325`, `350`, `375`, `400`, `425`, `475`, `500` cm) são OGC-válidas (`shapely.is_valid == True`).
- 3 camadas (`450`, `525`, `550` cm) apresentam ponto isolado de `Ring Self-intersection` no GeoJSON bruto do MapServer (comum em vetorização de grade HEC-RAS de 10 m):
  - `COTA_450cm`: `Ring Self-intersection[-42.1626779363594 -21.5405376845409]`
  - `COTA_525cm`: `Ring Self-intersection[-42.1859040992609 -21.5332524649665]`
  - `COTA_550cm`: `Ring Self-intersection[-42.1561279171297 -21.5353726362583]`
- Em todas as 3 camadas, `polygon-clipping.union` (TS) e `shapely.make_valid + union_all` (Python) convergiram para a mesma área dentro de `0,002 m²`.

## 4. Tabela comparativa das 11 camadas oficiais SGB

| Cota | Layer ID | SHA-256 do GeoJSON (`outSR=4326`) | Bytes | Raw OGC válida | Área TS (m²) | Área Karney WGS84 (m²) | Diff Karney (m² / %) | Área UTM 23S `EPSG:31983` (m²) | Diff UTM 23S (m² / %) |
|---:|---:|---|---:|---|---:|---:|---:|---:|---:|
| 300 cm | 3 | `100cd53b4ca6be2abf33fbefd9c0701c6765cc3bd609dead7e82cf3442be394f` | 755.946 | Sim | 1.706.207,160 | 1.706.207,161 | -0,001 (-0,000000%) | 1.708.449,443 | -2.242,283 (-0,131247%) |
| 325 cm | 4 | `d71da1ddea373ef1348037e192a94925e9b9bd5e6a0302d28f5436c355fe2fd0` | 749.198 | Sim | 1.748.780,085 | 1.748.780,087 | -0,002 (-0,000000%) | 1.751.078,891 | -2.298,806 (-0,131279%) |
| 350 cm | 5 | `5bea349d8fa0779988c26c23b9570e5e5e55136b6a24f8b00f148101906e38d8` | 772.498 | Sim | 1.791.640,686 | 1.791.640,687 | -0,000 (-0,000000%) | 1.793.996,213 | -2.355,527 (-0,131301%) |
| 375 cm | 6 | `935ba0fcf2decccf3123467512b69237abc1e3a52e39cf563faf7ca3d9873d84` | 804.229 | Sim | 1.841.142,021 | 1.841.142,021 | -0,000 (-0,000000%) | 1.843.562,993 | -2.420,971 (-0,131320%) |
| 400 cm | 7 | `1c4b1d6eada2d8f4af5101df9cdfe4b6faea8bb68b917fe6c7b78d7756711b7f` | 836.901 | Sim | 1.899.852,786 | 1.899.852,787 | -0,001 (-0,000000%) | 1.902.351,118 | -2.498,332 (-0,131329%) |
| 425 cm | 8 | `0f8121a22f2ddda9d91b16c77e27d740a47bbbba7a511186f25e13deceac09d8` | 900.266 | Sim | 1.967.286,602 | 1.967.286,604 | -0,002 (-0,000000%) | 1.969.873,550 | -2.586,948 (-0,131326%) |
| 450 cm | 9 | `1c48a29067e351f8e01da2f1b212501685ed08a6b9139c75dfe45d7e375bdaed` | 970.990 | Não (self-touch) | 2.052.104,191 | 2.052.104,193 | -0,002 (-0,000000%) | 2.054.802,213 | -2.698,022 (-0,131303%) |
| 475 cm | 10 | `27fdcb7988d0ae1dbaa59ebd49201eff72a6c22880ea4b8b5146f945e41bda37` | 1.051.435 | Sim | 2.160.376,689 | 2.160.376,691 | -0,003 (-0,000000%) | 2.163.216,362 | -2.839,673 (-0,131271%) |
| 500 cm | 11 | `fd97cc0763993e68e9690980d31f73e46272a02d7c4dd4479fac2ee5caaef00a` | 1.334.540 | Sim | 2.310.320,715 | 2.310.320,713 | +0,002 (+0,000000%) | 2.313.356,058 | -3.035,343 (-0,131210%) |
| 525 cm | 12 | `c10d10e2735124632a97f1dfdcb6662663942c1ae9ec15efd32f9c21560be0a5` | 1.498.430 | Não (self-touch) | 2.522.000,862 | 2.522.000,864 | -0,002 (-0,000000%) | 2.525.311,749 | -3.310,887 (-0,131108%) |
| 550 cm | 13 | `b02037c35320dd7e9bbbf00fc3c2c53ef9060987b4a1bb2462c4b86caa39daa4` | 1.437.811 | Não (self-touch) | 2.719.339,815 | 2.719.339,815 | -0,000 (-0,000000%) | 2.722.907,398 | -3.567,583 (-0,131021%) |

## 5. Comandos de reprodução

```bash
# 1. Instalar ambiente Python temporário com PyProj e Shapely
python3 -m venv /tmp/geo-venv
/tmp/geo-venv/bin/pip install pyproj shapely

# 2. Baixar os 11 GeoJSON oficiais para /tmp/sgb_validation, registrar SHA-256 e executar lib/sgb/area.ts
# (payloads brutos permanecem fora do Git em /tmp/sgb_validation/)
node --input-type=module -e '
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { computeDerivedFloodArea } from "./lib/sgb/area.ts";
mkdirSync("/tmp/sgb_validation", { recursive: true });
const BASE = "https://geoportal.sgb.gov.br/server/rest/services/hidrologia/mancha_santo_antonio_de_padua/MapServer";
const meta = await (await fetch(`${BASE}?f=pjson`)).json();
const out = [];
for (const lv of [300,325,350,375,400,425,450,475,500,525,550]) {
  const layer = meta.layers.find((l) => l.name === `COTA_${lv}cm`);
  const raw = await (await fetch(`${BASE}/${layer.id}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson`)).text();
  writeFileSync(`/tmp/sgb_validation/COTA_${lv}cm.geojson`, raw);
  const res = computeDerivedFloodArea(JSON.parse(raw), lv);
  out.push({ levelCm: lv, layerName: `COTA_${lv}cm`, sha256: createHash("sha256").update(raw).digest("hex"), tsAreaM2: res.areaSquareMeters });
}
writeFileSync("/tmp/sgb_validation/ts_results.json", JSON.stringify(out, null, 2));
'

# 3. Validar com PyProj (Karney WGS84 e EPSG:31983 UTM 23S) sobre os mesmos arquivos
/tmp/geo-venv/bin/python -c '
import hashlib, json, pyproj
from shapely.geometry import shape
from shapely.ops import transform
from shapely import union_all, is_valid, make_valid
geod = pyproj.Geod(ellps="WGS84")
to_utm = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:31983", always_xy=True).transform
for r in json.load(open("/tmp/sgb_validation/ts_results.json")):
    raw = open(f"/tmp/sgb_validation/{r[\"layerName\"]}.geojson", "rb").read()
    assert hashlib.sha256(raw).hexdigest() == r["sha256"]
    geoms = [shape(f["geometry"]) for f in json.loads(raw)["features"]]
    merged = union_all([g if is_valid(g) else make_valid(g) for g in geoms])
    g_m2 = abs(geod.geometry_area_perimeter(merged)[0])
    u_m2 = abs(transform(to_utm, merged).area)
    print(r["layerName"], f"TS={r[\"tsAreaM2\"]:.3f}", f"Geod={g_m2:.3f}", f"dGeod={r[\"tsAreaM2\"]-g_m2:+.3f}", f"UTM23S={u_m2:.3f}")
'
```
