import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("maplibre-gl/package.json");
const installed = JSON.parse(await readFile(packagePath, "utf8"));
const project = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (installed.version !== project.dependencies["maplibre-gl"]) {
  throw new Error("MapLibre installed version differs from the pinned application version");
}
const destination = new URL("../public/maplibre/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(dirname(packagePath), "dist", file), new URL(file, destination));
}
await copyFile(join(dirname(packagePath), "LICENSE.txt"), new URL("LICENSE.txt", destination));
console.log(`MapLibre ${installed.version}: worker, shared module and license synchronized`);
