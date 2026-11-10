// Team (subdomain) selection. Tymy serves every team from `<subdomain>.tymy.cz`, and
// the app talks to the API of that host, so the chosen team is stored next to the
// session and sent as `X-Team-Subdomain` (the dev proxy turns it into the upstream host).
//
// Kept dependency-free so `api.ts` can import it without cycles.

const TEAM_STORAGE_KEY = 'tymy:team'

export const TEAM_DOMAIN = 'tymy.cz'

/** `https://Foo.TYMY.cz/` → `foo` */
export function normalizeTeam(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(new RegExp(`\\.${TEAM_DOMAIN.replace(/\./g, '\\.')}$`), '')
    .replace(/[^a-z0-9-]/g, '')
}

export function getTeam(): string | null {
  try {
    const value = localStorage.getItem(TEAM_STORAGE_KEY)
    return value ? normalizeTeam(value) : null
  } catch {
    return null
  }
}

export function storeTeam(team: string): void {
  try {
    localStorage.setItem(TEAM_STORAGE_KEY, normalizeTeam(team))
  } catch {
    // storage unavailable – the selection just won't survive a reload
  }
}

export function clearTeam(): void {
  try {
    localStorage.removeItem(TEAM_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function teamHost(team: string): string {
  return `${normalizeTeam(team)}.${TEAM_DOMAIN}`
}

/** The team implied by the current hostname, when the app runs on a team domain. */
export function teamFromHostname(): string | null {
  const suffix = `.${TEAM_DOMAIN}`
  const host = window.location.hostname
  if (!host.endsWith(suffix)) return null
  const team = host.slice(0, -suffix.length)
  return team && team !== 'www' ? team : null
}

/** Value the team field starts with: stored choice → current host → dev instance. */
export function suggestedTeam(): string {
  return getTeam() ?? teamFromHostname() ?? (import.meta.env.DEV ? 'dev' : '')
}
