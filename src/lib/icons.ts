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
  mdilArrowLeft,
  mdilArrowRightCircle,
  mdilBell,
  mdilCalendar,
  mdilCancel,
  mdilChartBar,
  mdilCheck,
  mdilChevronDown,
  mdilChevronUp,
  mdilClock,
  mdilConsole,
  mdilDelete,
  mdilDotsHorizontal,
  mdilFormatBold,
  mdilFormatItalic,
  mdilFormatListBulleted,
  mdilFormatQuoteClose,
  mdilFormatUnderline,
  mdilGroup,
  mdilImage,
  mdilLink,
  mdilLogout,
  mdilMagnify,
  mdilMenu,
  mdilMessageText,
  mdilPaperclip,
  mdilPencil,
  mdilPlus,
  mdilRefresh,
  mdilSettings
} from '@mdi/light-js/mdil.js'

const icon = (path: string): string =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`

export const ICONS: Record<string, string> = {
  // Sections
  calendar: icon(mdilCalendar),
  chat: icon(mdilMessageText),
  poll: icon(mdilChartBar),
  users: icon(mdilGroup),
  user: icon(mdilAccount),

  // Navigation / chrome
  menu: icon(mdilMenu),
  back: icon(mdilArrowLeft),
  chevronDown: icon(mdilChevronDown),
  chevronUp: icon(mdilChevronUp),
  more: icon(mdilDotsHorizontal),
  bell: icon(mdilBell),
  settings: icon(mdilSettings),
  logout: icon(mdilLogout),

  // Chat
  send: icon(mdilArrowRightCircle),
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
  close: icon(mdilCancel),
  check: icon(mdilCheck),
  edit: icon(mdilPencil),
  delete: icon(mdilDelete),
  plus: icon(mdilPlus),
  search: icon(mdilMagnify),
  clock: icon(mdilClock),
  image: icon(mdilImage),
  // No dedicated spinner glyph in MDI Light; a spinning refresh arrow reads the same.
  spinner: icon(mdilRefresh)
}
