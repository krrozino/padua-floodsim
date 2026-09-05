export const SGB_FLOOD_LEVELS_CM = [
  300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550,
] as const;

export type SgbFloodLevelCm = (typeof SGB_FLOOD_LEVELS_CM)[number];

export const SGB_STAGE_ELEVATIONS: Record<SgbFloodLevelCm, number> = {
  300: 82.71,
  325: 82.96,
  350: 83.21,
  375: 83.46,
  400: 83.71,
  425: 83.96,
  450: 84.21,
  475: 84.46,
  500: 84.71,
  525: 84.96,
  550: 85.21,
};
