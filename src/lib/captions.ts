// Captions / i18n system for Tymy API

import { createSignal, createMemo, createEffect } from 'solid-js'
import { getCaptions } from './api'
import type { Caption } from './types'

type Language = 'CZ' | 'EN'

// Default fallback captions
const DEFAULT_CAPTIONS: Record<string, Record<string, string>> = {
  common: {
    loading: 'Načítání...',
    error: 'Chyba',
    retry: 'Zkusit znovu',
    save: 'Uložit',
    cancel: 'Zrušit',
    delete: 'Smazat',
    edit: 'Upravit',
    create: 'Vytvořit',
    confirm: 'Potvrdit',
    yes: 'Ano',
    no: 'Ne',
    ok: 'OK',
    close: 'Zavřít',
    back: 'Zpět',
    next: 'Další',
    previous: 'Předchozí',
    search: 'Hledat',
    filter: 'Filtrovat',
    sort: 'Seřadit',
    all: 'Vše',
    none: 'Žádné',
    today: 'Dnes',
    tomorrow: 'Zítra',
    yesterday: 'Včera'
  },
  events: {
    title: 'Události',
    training: 'Trénink',
    running: 'Běhání',
    meeting: 'Schůze',
    tournament: 'Turnaj',
    camp: 'Soustředění',
    noEvents: 'Žádné události',
    upcoming: 'Přicházející',
    past: 'Minulé',
    allEvents: 'Všechny události',
    myEvents: 'Moje události',
    attendance: 'Účast',
    willAttend: 'Přijdu',
    willNotAttend: 'Nepřijdu',
    late: 'Přijdu později',
    unknown: 'Nevím',
    rsvp: 'Potvrdit účast',
    eventDetails: 'Detail události',
    startTime: 'Začátek',
    endTime: 'Konec',
    closeTime: 'Uzavření přihlášek',
    place: 'Místo',
    description: 'Popis',
    type: 'Typ',
    link: 'Odkaz',
    attendees: 'Účastníci',
    history: 'Historie změn',
    createEvent: 'Vytvořit událost',
    editEvent: 'Upravit událost',
    deleteEvent: 'Smazat událost',
    confirmDelete: 'Opravdu smazat tuto událost?'
  },
  discussions: {
    title: 'Diskuze',
    teamDiscussion: 'Týmová diskuze',
    announcements: 'Oznámení',
    apiDiscussion: 'API diskuze',
    bugs: 'Bugy',
    noDiscussions: 'Žádné diskuze',
    newPosts: 'Nové příspěvky',
    writePost: 'Napsat příspěvek',
    reply: 'Odpovědět',
    editPost: 'Upravit',
    deletePost: 'Smazat',
    sticky: 'Připnout',
    locked: 'Zamčeno',
    noPosts: 'Žádné příspěvky',
    loadMore: 'Načíst více',
    search: 'Hledat v diskuzi',
    searchPlaceholder: 'Hledat...',
    formatting: 'Formátování: BBCode',
    bold: 'Tučné',
    italic: 'Kurzíva',
    link: 'Odkaz',
    quote: 'Citace',
    code: 'Kód',
    list: 'Seznam',
    image: 'Obrázek'
  },
  auth: {
    login: 'Přihlásit se',
    logout: 'Odhlásit se',
    register: 'Registrace',
    email: 'E-mail',
    password: 'Heslo',
    confirmPassword: 'Potvrdit heslo',
    loginName: 'Přihlašovací jméno',
    callName: 'Zobrazované jméno',
    firstName: 'Jméno',
    lastName: 'Příjmení',
    forgotPassword: 'Zapomněli jste heslo?',
    resetPassword: 'Resetovat heslo',
    resetLinkSent: 'Odkaz pro reset byl odeslán na e-mail',
    loginSuccess: 'Přihlášení proběhlo úspěšně',
    loginError: 'Chyba přihlášení',
    registerSuccess: 'Registrace proběhla úspěšně. Čeká na schválení administrátorem.',
    registerError: 'Chyba registrace',
    logoutConfirm: 'Opravdu se chcete odhlásit?'
  },
  polls: {
    title: 'Ankety',
    vote: 'Hlasovat',
    results: 'Výsledky',
    noPolls: 'Žádné ankety',
    pollClosed: 'Anketa uzavřena',
    pollOpen: 'Anketa otevřená',
    voted: 'Hlasováno',
    changeVote: 'Změnit hlas',
    minItems: 'Minimum položek',
    maxItems: 'Maximum položek',
    anonymous: 'Anonymní výsledky',
    showResults: 'Zobrazit výsledky'
  },
  notes: {
    title: 'Poznámky',
    welcome: 'Vítejte',
    loginPage: 'Přihlašovací stránka',
    public: 'Veřejná',
    private: 'Soukromá',
    editNote: 'Upravit poznámku',
    createNote: 'Vytvořit poznámku',
    deleteNote: 'Smazat poznámku'
  },
  profile: {
    title: 'Profil',
    editProfile: 'Upravit profil',
    avatar: 'Avatar',
    uploadAvatar: 'Nahrát avatar',
    changeAvatar: 'Změnit avatar',
    removeAvatar: 'Odstranit avatar',
    personalInfo: 'Osobní údaje',
    contactInfo: 'Kontaktní údaje',
    address: 'Adresa',
    phone: 'Telefon',
    birthDate: 'Datum narození',
    nameDay: 'Svátek',
    jerseyNumber: 'Číslo dresu',
    gender: 'Pohlaví',
    male: 'Muž',
    female: 'Žena',
    language: 'Jazyk',
    role: 'Role',
    status: 'Status',
    player: 'Hráč',
    member: 'Člen',
    sick: 'Nemocný',
    deleted: 'Smazán',
    init: 'Neaktivní'
  },
  errors: {
    network: 'Chyba sítě. Zkontrolujte připojení k internetu.',
    unauthorized: 'Neoprávněný přístup. Prosím, přihlaste se znovu.',
    forbidden: 'Nemáte oprávnění k této akci.',
    notFound: 'Požadovaný prostředek nebyl nalezen.',
    serverError: 'Chyba serveru. Zkuste to prosím později.',
    validation: 'Zkontrolujte prosím vyplněné údaje.',
    unknown: 'Neznámá chyba.'
  }
}

const [captions, setCaptions] = createSignal<Record<string, Record<string, string>>>(DEFAULT_CAPTIONS)
const [currentLanguage, setCurrentLanguage] = createSignal<Language>('CZ')
const [isLoading, setIsLoading] = createSignal(false)

// Load captions from API
export async function loadCaptions(lang: Language = 'CZ'): Promise<void> {
  setIsLoading(true)
  try {
    const data = await getCaptions()
    const organized: Record<string, Record<string, string>> = { ...DEFAULT_CAPTIONS }
    
    data.forEach((caption: Caption) => {
      if (caption.language === lang) {
        organized[caption.domain] = organized[caption.domain] ?? {}
        organized[caption.domain]![caption.code] = caption.value
      }
    })
    
    setCaptions(organized)
    setCurrentLanguage(lang)
  } catch (error) {
    // The captions endpoint is not available on every deployment; defaults are used.
    console.debug('Captions not loaded, using built-in defaults.')
  } finally {
    setIsLoading(false)
  }
}

// Translation function type
type TranslateFn = (domain: string, code: string, fallback?: string) => string

// Captions hook return type
interface CaptionsHook {
  t: () => TranslateFn
  tDomain: () => (domain: string) => Record<string, string>
  language: () => Language
  setLanguage: (lang: Language) => void
  isLoading: () => boolean
  loadCaptions: (lang: Language) => Promise<void>
}

// Common captions hook return type
interface CommonCaptionsHook {
  tCommon: (code: string, fallback?: string) => string
  tEvents: (code: string, fallback?: string) => string
  tDiscussions: (code: string, fallback?: string) => string
  tAuth: (code: string, fallback?: string) => string
  tPolls: (code: string, fallback?: string) => string
  tNotes: (code: string, fallback?: string) => string
  tProfile: (code: string, fallback?: string) => string
  tErrors: (code: string, fallback?: string) => string
}

// ============================================
// Translation Hook
// ============================================

export function useCaptions(): CaptionsHook {
  const t = createMemo((): TranslateFn => {
    const caps = captions()
    return (domain: string, code: string, fallback?: string): string => {
      return caps[domain]?.[code] ?? DEFAULT_CAPTIONS[domain]?.[code] ?? fallback ?? code
    }
  })

  const tDomain = createMemo(() => {
    const caps = captions()
    return (domain: string): Record<string, string> => {
      return { ...DEFAULT_CAPTIONS[domain], ...caps[domain] }
    }
  })

  return {
    t,
    tDomain,
    language: currentLanguage,
    setLanguage: setCurrentLanguage,
    isLoading,
    loadCaptions
  }
}

// Shorthand for common domains
export function useCommonCaptions(): CommonCaptionsHook {
  const { t } = useCaptions()
  return {
    tCommon: (code: string, fallback?: string) => t()('common', code, fallback),
    tEvents: (code: string, fallback?: string) => t()('events', code, fallback),
    tDiscussions: (code: string, fallback?: string) => t()('discussions', code, fallback),
    tAuth: (code: string, fallback?: string) => t()('auth', code, fallback),
    tPolls: (code: string, fallback?: string) => t()('polls', code, fallback),
    tNotes: (code: string, fallback?: string) => t()('notes', code, fallback),
    tProfile: (code: string, fallback?: string) => t()('profile', code, fallback),
    tErrors: (code: string, fallback?: string) => t()('errors', code, fallback)
  }
}