/** Event type code → semantic colour token (light/dark variants live in `index.css`). */
export const EVENT_TYPE_COLORS: Record<string, string> = {
  TRA: 'primary',
  RUN: 'success',
  MEE: 'info',
  TOU: 'warning',
  CMP: 'danger'
}

export const STATUS_COLORS: Record<string, string> = {
  YES: 'success',
  NO: 'danger',
  LAT: 'warning',
  DKY: 'secondary',
  CHCI: 'success',
  NECHCI: 'danger',
  NEVIM: 'secondary'
}

export const STATUS_LABELS: Record<string, string> = {
  YES: 'Přijdu',
  NO: 'Nepřijdu',
  LAT: 'Přijdu později',
  DKY: 'Nevím',
  CHCI: 'Chci',
  NECHCI: 'Nechci',
  NEVIM: 'Nevím'
}