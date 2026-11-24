/** Neon lane palette, ordered so neighbouring lanes contrast strongly. */
export const LANE_COLORS = [
  "#00f0ff", // cyan
  "#ff2e88", // magenta
  "#fcee0a", // yellow
  "#00ff9c", // green
  "#b44dff", // purple
  "#ff8a00", // orange
  "#3d7bff", // blue
  "#ff6ec7", // pink
];

export function laneColor(index: number): string {
  return LANE_COLORS[index % LANE_COLORS.length];
}
