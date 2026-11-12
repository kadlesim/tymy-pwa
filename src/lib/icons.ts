// Shared inline SVG icon set: Material Design Light by Pictogrammers.
// https://github.com/Pictogrammers/MaterialDesignLight (MIT licence, 24×24 glyphs)
//
// Path data comes from the `@mdi/light-js` package; only the icons listed below are
// imported, so Rollup tree-shakes the rest away. Icons are filled shapes that paint
// with `currentColor`, so size them via the `.icon` / `.icon-sm` classes and colour
// them with any text-* utility.
//
// Kept free of any component imports so it can be used anywhere.

import {
  mdilAccount,
  mdilAlertCircle,
  mdilArrowLeft,
  mdilBell,
  mdilCalendar,
  mdilChartBar,
  mdilCheck,
  mdilChevronDoubleLeft,
  mdilChevronDown,
  mdilChevronLeft,
  mdilChevronRight,
  mdilChevronUp,
  mdilClipboardText,
  mdilClock,
  mdilConsole,
  mdilContentDuplicate,
  mdilDelete,
  mdilDotsHorizontal,
  mdilDownload,
  mdilEye,
  mdilFolder,
  mdilFormatBold,
  mdilFormatItalic,
  mdilFormatListBulleted,
  mdilFormatQuoteClose,
  mdilFormatUnderline,
  mdilGroup,
  mdilImage,
  mdilLink,
  mdilLock,
  mdilLogout,
  mdilMagnify,
  mdilMapMarker,
  mdilMenu,
  mdilMessageText,
  mdilPaperclip,
  mdilPencil,
  mdilPin,
  mdilPlus,
  mdilRefresh,
  mdilSettings,
  mdilUpload
} from '@mdi/light-js/mdil.js'

const icon = (path: string): string =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`

/** For glyphs that need more than a single filled path (strokes, text). */
const rawIcon = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>`

export const ICONS: Record<string, string> = {
  // Sections
  calendar: icon(mdilCalendar),
  chat: icon(mdilMessageText),
  poll: icon(mdilChartBar),
  users: icon(mdilGroup),
  user: icon(mdilAccount),
  files: icon(mdilFolder),
  reports: icon(mdilClipboardText),

  // Navigation / chrome
  menu: icon(mdilMenu),
  back: icon(mdilArrowLeft),
  collapse: icon(mdilChevronDoubleLeft),
  chevronDown: icon(mdilChevronDown),
  chevronLeft: icon(mdilChevronLeft),
  chevronRight: icon(mdilChevronRight),
  chevronUp: icon(mdilChevronUp),
  more: icon(mdilDotsHorizontal),
  bell: icon(mdilBell),
  settings: icon(mdilSettings),
  logout: icon(mdilLogout),
  location: icon(mdilMapMarker),

  // Chat
  send: icon(mdilUpload),
  attach: icon(mdilPaperclip),
  refresh: icon(mdilRefresh),

  // BBCode toolbar
  bold: icon(mdilFormatBold),
  italic: icon(mdilFormatItalic),
  underline: icon(mdilFormatUnderline),
  quote: icon(mdilFormatQuoteClose),
  code: icon(mdilConsole),
  list: icon(mdilFormatListBulleted),
  link: icon(mdilLink),

  // Actions / status
  check: icon(mdilCheck),
  alert: icon(mdilAlertCircle),
  edit: icon(mdilPencil),
  copy: icon(mdilContentDuplicate),
  pin: icon(mdilPin),
  delete: icon(mdilDelete),
  close: rawIcon('<path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6Z"/>'),
  download: icon(mdilDownload),
  plus: icon(mdilPlus),
  search: icon(mdilMagnify),
  clock: icon(mdilClock),
  lock: icon(mdilLock),
  image: icon(mdilImage),
  eye: icon(mdilEye),
  // No dedicated spinner glyph in MDI Light; a spinning refresh arrow reads the same.
  spinner: icon(mdilRefresh),

  // Display preferences (custom glyphs — the bundled MDI Light subset has no moon/globe)
  themeLight: rawIcon(
    '<circle cx="12" cy="12" r="4.3"/>' +
      '<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
      '<path d="M12 2.4v2.7M12 18.9v2.7M2.4 12h2.7M18.9 12h2.7M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9"/>' +
      '</g>'
  ),
  themeDark: rawIcon('<path d="M12.4 3A9 9 0 1 0 21 12.6 7.2 7.2 0 0 1 12.4 3Z"/>'),
  language: rawIcon(
    '<g fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<circle cx="12" cy="12" r="8.4"/>' +
      '<ellipse cx="12" cy="12" rx="4" ry="8.4"/>' +
      '<path d="M3.7 12h16.6"/>' +
      '</g>'
  ),
  textSize: rawIcon(
    '<text x="2.2" y="15.5" font-size="11" font-weight="700" font-family="sans-serif" fill="currentColor">A</text>' +
      '<text x="11.6" y="20" font-size="15.5" font-weight="700" font-family="sans-serif" fill="currentColor">A</text>'
  )
}
