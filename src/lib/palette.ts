import type { Health } from '@shared/scoring'

/**
 * Health speaks stellar spectral classes, hot to cool: thriving O/B (blue),
 * active A/F (white), quiet G (yellow), dormant K (orange), archived M (red).
 * Checked against the #050607 field: every class ≥ 6.6:1 contrast; all-pairs
 * CVD ΔE ≥ 14.7 (deuteranopia, quiet/dormant the closest pair). Color is never
 * the only signal: dormant marks are dimmer and archived marks are hollow.
 */
export const HEALTH_CHART: Record<Health, string> = {
  thriving: '#6ea8ff',
  active: '#e9e4d4',
  quiet: '#ffd84d',
  dormant: '#ff9b42',
  archived: '#ff5b4d',
}

export const HEALTH_CLASS: Record<Health, string> = {
  thriving: 'O/B',
  active: 'A/F',
  quiet: 'G',
  dormant: 'K',
  archived: 'M',
}

/** Language view on the star map: three distinct hues plus a neutral "other". */
export const CATEGORICAL_3 = ['#6ea8ff', '#ff9b42', '#e9e4d4'] as const
export const OTHER = '#5a6068'

/** The single luminous accent, for canvas drawing. */
export const ACCENT = '#c8ff3a'
