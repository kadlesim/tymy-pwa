// "Remember me" for the login screen.
//
// The session itself lives in localStorage (`tymy:tsid`) and dies when the server
// expires it, so the login form is shown again regularly — on phones especially, as an
// installed PWA gets opened days after the last visit. The credentials are therefore
// kept per team under `tymy:login:{team}` and prefilled by `LoginPage`, so a returning
// user only has to tap "Přihlásit".
//
// Caveat: this is plain text in localStorage — it is only as safe as the device. It is
// opt-in through the "Zapamatovat mě" checkbox and removed as soon as the box is
// cleared or another account signs in.
//
// Kept dependency-free so it can be imported from anywhere (only `team.ts`).

import { getTeam } from './team'

const LOGIN_PREFIX = 'tymy:login:'

export interface RememberedLogin {
  login: string
  password: string
}

function storageKey(team: string): string {
  return `${LOGIN_PREFIX}${team}`
}

/** Stored credentials for `team` (defaults to the selected team), or null. */
export function getRememberedLogin(team: string | null = getTeam()): RememberedLogin | null {
  if (!team) return null
  try {
    const raw = localStorage.getItem(storageKey(team))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RememberedLogin> | null
    if (!parsed || typeof parsed.login !== 'string' || typeof parsed.password !== 'string') {
      return null
    }
    return { login: parsed.login, password: parsed.password }
  } catch {
    return null
  }
}

export function storeRememberedLogin(
  credentials: RememberedLogin,
  team: string | null = getTeam()
): void {
  if (!team) return
  try {
    localStorage.setItem(storageKey(team), JSON.stringify(credentials))
  } catch {
    // storage unavailable – the login just won't be remembered
  }
}

export function clearRememberedLogin(team: string | null = getTeam()): void {
  if (!team) return
  try {
    localStorage.removeItem(storageKey(team))
  } catch {
    // ignore
  }
}
