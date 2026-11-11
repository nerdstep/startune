import type { Health } from "@shared/scoring";

/**
 * Chart colors, validated with the dataviz palette checker against the dark
 * surface (#0f1020): lightness band, chroma floor, adjacent CVD ΔE ≥ 8, normal ΔE ≥ 15.
 * Health is ordered for stacks (adjacent pairs). The star map uses all-pairs, so it
 * adds shape/opacity as a second encoding for health.
 */
export const HEALTH_CHART: Record<Health, string> = {
  thriving: "#55ad40",
  active: "#009eb9",
  quiet: "#c8800d",
  dormant: "#695ba9",
  archived: "#e23248",
};

/** First three slots of the reference categorical palette (dark): pass all-pairs. */
export const CATEGORICAL_3 = ["#3987e5", "#d95926", "#199e70"] as const;
export const OTHER = "#5c627a";
