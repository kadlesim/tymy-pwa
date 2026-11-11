// Localised event-type and attendance captions.
//
// The API returns the team's own captions, which are usually Czech. When the UI language
// is English we prefer a caption the server already localised; if the server sent the
// empty string or one of the built-in Czech defaults, we fall back to our own English
// translation of the standard codes. Custom captions on custom codes are left alone.

import { lang } from './prefs'

/** Built-in Czech captions used by the standard event types. */
const CZECH_TYPE_CAPTIONS: Record<string, string[]> = {
  TRA: ['Trénink'],
  RUN: ['Běhání'],
  MEE: ['Schůze'],
  TOU: ['Turnaj'],
  CMP: ['Zápas']
}

const ENGLISH_TYPE_CAPTIONS: Record<string, string> = {
  TRA: 'Training',
  RUN: 'Running',
  MEE: 'Meeting',
  TOU: 'Tournament',
  CMP: 'Match'
}

/** Built-in Czech captions for both attendance sets (pre- and post-status). */
const CZECH_STATUS_CAPTIONS: Record<string, string[]> = {
  YES: ['Přijdu', 'Účast'],
  NO: ['Nepřijdu', 'Omlouvám se', 'Neúčast'],
  LAT: ['Přijdu později', 'Pozdní příchod'],
  DKY: ['Nevím'],
  CHCI: ['Chci'],
  NECHCI: ['Nechci'],
  NEVIM: ['Nevím']
}

const ENGLISH_STATUS_CAPTIONS: Record<string, string> = {
  YES: 'Attending',
  NO: 'Not attending',
  LAT: 'Arriving late',
  DKY: 'Not sure',
  CHCI: 'Yes',
  NECHCI: 'No',
  NEVIM: 'Not sure'
}

const isKnownCzech = (caption: string, defaults: string[] | undefined): boolean => {
  if (!defaults) return false
  const trimmed = caption.trim()
  return defaults.some(value => value === trimmed)
}

export function eventTypeCaption(
  code: string,
  caption?: string | null,
  fallback?: string
): string {
  const apiCaption = (caption ?? '').trim()
  if (lang() !== 'en') return apiCaption || fallback || code

  const english = ENGLISH_TYPE_CAPTIONS[code]
  if (!english) return apiCaption || fallback || code
  if (apiCaption && !isKnownCzech(apiCaption, CZECH_TYPE_CAPTIONS[code])) return apiCaption
  return english
}

export function attendanceCaption(code: string, caption?: string | null): string {
  const apiCaption = (caption ?? '').trim()
  if (lang() !== 'en') return apiCaption || code

  const english = ENGLISH_STATUS_CAPTIONS[code]
  if (!english) return apiCaption || code
  if (apiCaption && !isKnownCzech(apiCaption, CZECH_STATUS_CAPTIONS[code])) return apiCaption
  return english
}
