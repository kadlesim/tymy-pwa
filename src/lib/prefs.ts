// Display preferences: colour theme, UI language and text size.
//
// Kept in localStorage and applied to <html> (class + data attribute + lang) so the CSS
// variables in index.css and the root font size do the actual work. `initPrefs()` is
// called from main.tsx before the first render to avoid a flash of the wrong theme.

import { createSignal } from 'solid-js'

export type Theme = 'light' | 'dark'
export type TextSize = 'normal' | 'large'
export type UiLang = 'cs' | 'en'

const THEME_KEY = 'tymy:theme'
const TEXT_SIZE_KEY = 'tymy:text-size'
const LANG_KEY = 'tymy:lang'

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage can be unavailable (private mode) — the preference just won't stick
  }
}

const storedTheme = readStored(THEME_KEY)
const storedTextSize = readStored(TEXT_SIZE_KEY)
const storedLang = readStored(LANG_KEY)

export const [theme, setThemeSignal] = createSignal<Theme>(storedTheme === 'dark' ? 'dark' : 'light')
export const [textSize, setTextSizeSignal] = createSignal<TextSize>(
  storedTextSize === 'large' ? 'large' : 'normal'
)
export const [lang, setLangSignal] = createSignal<UiLang>(storedLang === 'en' ? 'en' : 'cs')

function applyTheme(value: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', value === 'dark')
  document.documentElement.style.colorScheme = value
}

function applyTextSize(value: TextSize): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset['textSize'] = value
}

function applyLang(value: UiLang): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = value
}

export function setTheme(value: Theme): void {
  setThemeSignal(value)
  writeStored(THEME_KEY, value)
  applyTheme(value)
}

export function toggleTheme(): void {
  setTheme(theme() === 'dark' ? 'light' : 'dark')
}

export function setTextSize(value: TextSize): void {
  setTextSizeSignal(value)
  writeStored(TEXT_SIZE_KEY, value)
  applyTextSize(value)
}

export function toggleTextSize(): void {
  setTextSize(textSize() === 'large' ? 'normal' : 'large')
}

export function setLang(value: UiLang): void {
  setLangSignal(value)
  writeStored(LANG_KEY, value)
  applyLang(value)
}

/** Locale for `toLocaleDateString` / `toLocaleTimeString`. */
export function getLocale(): string {
  return lang() === 'en' ? 'en-GB' : 'cs-CZ'
}

/** Applied once at start-up, before the app renders. */
export function initPrefs(): void {
  applyTheme(theme())
  applyTextSize(textSize())
  applyLang(lang())
}
