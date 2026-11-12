// Main layout with header, bottom navigation, and responsive sidebar

import { createSignal, createMemo, createEffect, onCleanup, onMount } from 'solid-js'
import { useLocation, useNavigate, A } from '@solidjs/router'
import { useAuth, doLogout, getDisplayName, getUserAvatar } from '../../lib/auth'
import { useCommonCaptions } from '../../lib/captions'
import { ICONS } from '../../lib/icons'
import NotificationBell from '../notifications/NotificationBell'
import { theme, setTheme, toggleTheme, textSize, setTextSize, toggleTextSize, lang, setLang } from '../../lib/prefs'
import { tr } from '../../lib/i18n'

export { ICONS }

interface NavItem {
  path: string
  label: string
  icon: string
  /** Shown in the mobile bottom bar; secondary sections live in the drawer only. */
  primary?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { path: '/events', label: 'Události', icon: 'calendar', primary: true },
  { path: '/discussions', label: 'Chat', icon: 'chat', primary: true },
  { path: '/polls', label: 'Ankety', icon: 'poll', primary: true },
  { path: '/users', label: 'Tým', icon: 'users', primary: true },
  { path: '/files', label: 'Soubory', icon: 'files' },
  { path: '/reports', label: 'Reporty', icon: 'reports' },
  { path: '/profile', label: 'Profil', icon: 'user', primary: true }
]

export interface LayoutProps {
  children?: any
}

export default function Layout(props: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const { tAuth } = useCommonCaptions()
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const [userMenuOpen, setUserMenuOpen] = createSignal(false)
  const [navHidden, setNavHidden] = createSignal(false)

  // Mobile bottom bar hides while scrolling down and comes back on scroll up.
  // The document scrolls (`.app-main` grows with its content), not the <main> element.
  let lastScrollTop = 0
  let scrollTicking = false

  const handleMainScroll = () => {
    if (scrollTicking) return
    scrollTicking = true
    requestAnimationFrame(() => {
      const top = window.scrollY || document.documentElement.scrollTop
      const delta = top - lastScrollTop
      if (top <= 24) setNavHidden(false)
      else if (delta > 8) setNavHidden(true)
      else if (delta < -8) setNavHidden(false)
      lastScrollTop = top
      scrollTicking = false
    })
  }

  onMount(() => {
    window.addEventListener('scroll', handleMainScroll, { passive: true })
    onCleanup(() => window.removeEventListener('scroll', handleMainScroll))
  })

  // Every authenticated team member can reach these core sections.
  // Fine-grained permissions (canPlan, canWrite, …) are enforced per action.
  const visibleNavItems = createMemo(() => (auth().user ? NAV_ITEMS : []))
  const bottomNavItems = createMemo(() => visibleNavItems().filter(item => item.primary))

  createEffect(() => {
    location.pathname
    setSidebarOpen(false)
    setNavHidden(false)
    lastScrollTop = window.scrollY || document.documentElement.scrollTop
  })

  const handleClickOutside = (e: MouseEvent) => {
    const path = e.composedPath() as Array<Element | Window>

    // Clicks on a menu toggle must not immediately re-close the menu.
    const isToggle = path.some(el => el instanceof HTMLElement && el.dataset['toggle'] !== undefined)
    if (isToggle) return

    const inSidebar = path.some(el => el instanceof Element && el.classList?.contains('sidebar'))
    const inUserMenu = path.some(el => el instanceof Element && el.classList?.contains('user-menu'))

    if (sidebarOpen() && !inSidebar) setSidebarOpen(false)
    if (userMenuOpen() && !inUserMenu) setUserMenuOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSidebarOpen(false)
      setUserMenuOpen(false)
    }
  }

  createEffect(() => {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    })
  })

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await doLogout()
    navigate('/team')
  }

  return (
    <div class="app-layout min-h-dvh flex flex-col">
      {/* Header */}
      <header class="app-header fixed top-0 left-0 right-0 z-40 bg-elevated border-b border-border flex items-center justify-between px-4 h-[var(--header-height)]">
        <div class="flex items-center gap-2 min-w-0">
          <button
            class="header-btn p-2 rounded-lg hover:bg-100 lg:hidden"
            data-toggle="sidebar"
            onClick={() => setSidebarOpen(true)}
            aria-label={tr('Menu')}
            aria-expanded={sidebarOpen()}
          >
            <span class="icon" innerHTML={ICONS['menu']} />
          </button>

          <A href="/events" class="flex items-center gap-2 text-lg font-semibold text-text truncate">
            tymy.cz
          </A>

          {/* Desktop navigation */}
          <nav class="hidden lg:flex items-center gap-1 ml-4" aria-label={tr('Hlavní navigace')}>
            {visibleNavItems().map(item => (
              <A
                href={item.path}
                class="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                activeClass="bg-primary-light text-primary"
                inactiveClass="text-text-secondary hover:bg-100"
              >
                {tr(item.label)}
              </A>
            ))}
          </nav>
        </div>

        <div class="flex items-center gap-2">
          {/* Display preferences: desktop only — phones get the same controls in the drawer */}
          <div class="hidden md:flex items-center gap-1" role="group" aria-label={tr('Vzhled a jazyk')}>
            <button
              type="button"
              class="header-btn p-2 rounded-lg hover:bg-100"
              onClick={toggleTheme}
              title={theme() === 'dark' ? tr('Světlý režim') : tr('Tmavý režim')}
              aria-label={theme() === 'dark' ? tr('Světlý režim') : tr('Tmavý režim')}
              aria-pressed={theme() === 'dark'}
            >
              <span
                class="icon"
                innerHTML={theme() === 'dark' ? ICONS['themeLight'] : ICONS['themeDark']}
              />
            </button>

            <button
              type="button"
              class="header-btn p-2 rounded-lg hover:bg-100"
              onClick={() => setLang(lang() === 'cs' ? 'en' : 'cs')}
              title={tr('Jazyk')}
              aria-label={tr('Jazyk')}
            >
              <span class="w-5 text-center text-xs font-bold uppercase tracking-wide">{lang()}</span>
            </button>

            <button
              type="button"
              class="header-btn p-2 rounded-lg hover:bg-100"
              onClick={toggleTextSize}
              title={tr('Velikost textu')}
              aria-label={tr('Velikost textu')}
              aria-pressed={textSize() === 'large'}
            >
              <span class="icon" innerHTML={ICONS['textSize']} />
            </button>
          </div>

          <NotificationBell />

          <div class="user-menu relative">
            <button
              class="header-btn p-1 rounded-full hover:bg-100 flex items-center gap-2"
              data-toggle="user-menu"
              onClick={() => setUserMenuOpen(!userMenuOpen())}
              aria-label={tr('Uživatelské menu')}
              aria-expanded={userMenuOpen()}
            >
              <img
                src={getUserAvatar()}
                alt=""
                class="w-8 h-8 rounded-full object-cover border border-border"
              />
              <span class="hidden sm:block text-sm font-medium text-text">{getDisplayName()}</span>
              <span class="icon-sm" innerHTML={ICONS['chevronDown']} />
            </button>

            {userMenuOpen() && (
              <div class="user-dropdown absolute right-0 top-full mt-2 w-48 bg-elevated rounded-lg shadow-lg border border-border py-1 animate-slide-down" role="menu">
                <div class="px-3 py-2 border-b border-border">
                  <p class="text-sm font-medium text-text">{getDisplayName()}</p>
                  <p class="text-xs text-muted truncate">{auth().user?.email}</p>
                </div>
                <A
                  href="/profile"
                  class="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-100"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <span class="icon-sm" innerHTML={ICONS['user']} />
                  {tr('Profil')}
                </A>
                <A
                  href="/profile/settings"
                  class="flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-100"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <span class="icon-sm" innerHTML={ICONS['settings']} />
                  {tr('Nastavení')}
                </A>
                <hr class="my-1 border-border" />
                <button
                  class="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger-light"
                  onClick={handleLogout}
                >
                  <span class="icon-sm" innerHTML={ICONS['logout']} />
                  {tAuth('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen() && (
        <div
          class="sidebar-overlay fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        class="sidebar fixed top-0 left-0 bottom-0 z-60 w-[var(--sidebar-width)] bg-elevated border-r border-border transform transition-transform duration-300 ease-out"
        classList={{
          'translate-x-0': sidebarOpen(),
          '-translate-x-full': !sidebarOpen()
        }}
        aria-label={tr('Hlavní navigace')}
        aria-hidden={!sidebarOpen()}
      >
        <div class="flex flex-col h-full">
          <div class="p-4 border-b border-border flex items-center justify-between">
            <h2 class="font-semibold text-text">{tr('Navigace')}</h2>
            <button
              class="header-btn p-2 rounded-lg hover:bg-100"
              onClick={() => setSidebarOpen(false)}
              aria-label={tr('Zavřít menu')}
            >
              <span class="icon" innerHTML={ICONS['collapse']} />
            </button>
          </div>

          <nav class="flex-1 p-3 overflow-y-auto" role="navigation">
            <ul class="space-y-1" role="list">
              {visibleNavItems().map(item => (
                <li>
                  <A
                    href={item.path}
                    class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    activeClass="bg-primary-light text-primary"
                    inactiveClass="text-text-secondary hover:bg-100"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span class="icon w-5 h-5 flex-shrink-0" innerHTML={ICONS[item.icon]} />
                    <span class="flex-1 truncate">{tr(item.label)}</span>
                  </A>
                </li>
              ))}
            </ul>

            {/* Display preferences — the desktop header shows icons, phones use this block */}
            <div class="mt-4 pt-4 border-t border-border space-y-3">
              <p class="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {tr('Vzhled a jazyk')}
              </p>

              <div class="px-3 flex items-center justify-between gap-3">
                <span class="text-sm text-text-secondary">{tr('Tmavý režim')}</span>
                <div class="flex gap-1 bg-100 rounded-md p-0.5" role="group" aria-label={tr('Tmavý režim')}>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded text-xs font-medium"
                    classList={{
                      'bg-primary text-white': theme() === 'light',
                      'text-text-secondary': theme() !== 'light'
                    }}
                    aria-pressed={theme() === 'light'}
                    onClick={() => setTheme('light')}
                  >
                    {tr('Světlý')}
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded text-xs font-medium"
                    classList={{
                      'bg-primary text-white': theme() === 'dark',
                      'text-text-secondary': theme() !== 'dark'
                    }}
                    aria-pressed={theme() === 'dark'}
                    onClick={() => setTheme('dark')}
                  >
                    {tr('Tmavý')}
                  </button>
                </div>
              </div>

              <div class="px-3 flex items-center justify-between gap-3">
                <span class="text-sm text-text-secondary">{tr('Jazyk')}</span>
                <div class="flex gap-1 bg-100 rounded-md p-0.5" role="group" aria-label={tr('Jazyk')}>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded text-xs font-bold uppercase"
                    classList={{
                      'bg-primary text-white': lang() === 'cs',
                      'text-text-secondary': lang() !== 'cs'
                    }}
                    aria-pressed={lang() === 'cs'}
                    onClick={() => setLang('cs')}
                  >
                    CS
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded text-xs font-bold uppercase"
                    classList={{
                      'bg-primary text-white': lang() === 'en',
                      'text-text-secondary': lang() !== 'en'
                    }}
                    aria-pressed={lang() === 'en'}
                    onClick={() => setLang('en')}
                  >
                    EN
                  </button>
                </div>
              </div>

              <div class="px-3 flex items-center justify-between gap-3">
                <span class="text-sm text-text-secondary">{tr('Velikost textu')}</span>
                <div class="flex gap-1 bg-100 rounded-md p-0.5" role="group" aria-label={tr('Velikost textu')}>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded text-xs font-semibold"
                    classList={{
                      'bg-primary text-white': textSize() === 'normal',
                      'text-text-secondary': textSize() !== 'normal'
                    }}
                    aria-pressed={textSize() === 'normal'}
                    onClick={() => setTextSize('normal')}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded text-base font-semibold"
                    classList={{
                      'bg-primary text-white': textSize() === 'large',
                      'text-text-secondary': textSize() !== 'large'
                    }}
                    aria-pressed={textSize() === 'large'}
                    onClick={() => setTextSize('large')}
                  >
                    A
                  </button>
                </div>
              </div>
            </div>

            <div class="mt-auto pt-4 border-t border-border">
              <A
                href="/profile"
                class="px-3 py-2 flex items-center gap-3 rounded-lg hover:bg-100"
                onClick={() => setSidebarOpen(false)}
              >
                <img
                  src={getUserAvatar()}
                  alt=""
                  class="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                />
                <span class="flex-1 min-w-0 text-sm font-medium text-text truncate">
                  {getDisplayName()}
                </span>
                <span class="icon-sm text-muted flex-shrink-0" innerHTML={ICONS['chevronRight']} />
              </A>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main class="app-main flex-1 pt-[var(--header-height)] pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:pb-6 overflow-y-auto">
        <div class="container py-4">{props.children}</div>
      </main>

      {/* Bottom navigation (mobile) — slides away while scrolling down. */}
      <nav
        class="bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-elevated border-t border-border h-[var(--bottom-nav-height)] md:hidden transition-transform duration-200 ease-out"
        classList={{ 'translate-y-full': navHidden() }}
        role="navigation"
        aria-label={tr('Hlavní navigace')}
      >
        <ul class="flex h-full items-stretch justify-around" role="list">
          {bottomNavItems().map(item => (
            <li class="flex-1 min-w-0">
              <A
                href={item.path}
                class="bottom-nav-item h-full w-full flex flex-col items-center justify-center gap-1 px-1 py-1 text-[11px] font-medium transition-colors"
                activeClass="text-primary"
                inactiveClass="text-text-secondary"
              >
                <span class="icon w-6 h-6" innerHTML={ICONS[item.icon]} />
                <span class="truncate max-w-full">{tr(item.label)}</span>
              </A>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
