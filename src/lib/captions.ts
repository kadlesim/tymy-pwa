// Captions / i18n system for Tymy API

import { createSignal, createMemo } from 'solid-js'
import { getCaptions } from './api'
import { lang } from './prefs'
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

// English translations for the same codes. The server only serves Czech captions, so
// these are used whenever the UI language is English (see lib/prefs.ts).
const EN_CAPTIONS: Record<string, Record<string, string>> = {
  common: {
    loading: 'Loading…',
    error: 'Error',
    retry: 'Retry',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    all: 'All',
    none: 'None',
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday'
  },
  events: {
    title: 'Events',
    training: 'Training',
    running: 'Running',
    meeting: 'Meeting',
    tournament: 'Tournament',
    camp: 'Camp',
    noEvents: 'No events',
    upcoming: 'Upcoming',
    past: 'Past',
    allEvents: 'All events',
    myEvents: 'My events',
    attendance: 'Attendance',
    willAttend: 'Attending',
    willNotAttend: 'Not attending',
    late: 'Arriving late',
    unknown: 'Not sure',
    rsvp: 'Confirm attendance',
    eventDetails: 'Event details',
    startTime: 'Start',
    endTime: 'End',
    closeTime: 'Sign-up closes',
    place: 'Place',
    description: 'Description',
    type: 'Type',
    link: 'Link',
    attendees: 'Attendees',
    history: 'Change history',
    createEvent: 'Create event',
    editEvent: 'Edit event',
    deleteEvent: 'Delete event',
    confirmDelete: 'Really delete this event?'
  },
  discussions: {
    title: 'Discussions',
    teamDiscussion: 'Team discussion',
    announcements: 'Announcements',
    apiDiscussion: 'API discussion',
    bugs: 'Bugs',
    noDiscussions: 'No discussions',
    newPosts: 'New posts',
    writePost: 'Write a post',
    reply: 'Reply',
    editPost: 'Edit',
    deletePost: 'Delete',
    sticky: 'Pin',
    locked: 'Locked',
    noPosts: 'No posts',
    loadMore: 'Load more',
    search: 'Search this discussion',
    searchPlaceholder: 'Search…',
    formatting: 'Formatting: BBCode',
    bold: 'Bold',
    italic: 'Italic',
    link: 'Link',
    quote: 'Quote',
    code: 'Code',
    list: 'List',
    image: 'Image'
  },
  auth: {
    login: 'Sign in',
    logout: 'Sign out',
    register: 'Register',
    email: 'E-mail',
    password: 'Password',
    confirmPassword: 'Confirm password',
    loginName: 'Username',
    callName: 'Display name',
    firstName: 'First name',
    lastName: 'Last name',
    forgotPassword: 'Forgot your password?',
    resetPassword: 'Reset password',
    resetLinkSent: 'A reset link has been sent to your e-mail',
    loginSuccess: 'Signed in successfully',
    loginError: 'Sign-in failed',
    registerSuccess: 'Registration complete. An administrator will approve the account.',
    registerError: 'Registration failed',
    logoutConfirm: 'Do you really want to sign out?'
  },
  polls: {
    title: 'Polls',
    vote: 'Vote',
    results: 'Results',
    noPolls: 'No polls',
    pollClosed: 'Poll closed',
    pollOpen: 'Poll open',
    voted: 'Voted',
    changeVote: 'Change vote',
    minItems: 'Minimum items',
    maxItems: 'Maximum items',
    anonymous: 'Anonymous results',
    showResults: 'Show results'
  },
  notes: {
    title: 'Notes',
    welcome: 'Welcome',
    loginPage: 'Sign-in page',
    public: 'Public',
    private: 'Private',
    editNote: 'Edit note',
    createNote: 'Create note',
    deleteNote: 'Delete note'
  },
  profile: {
    title: 'Profile',
    settings: 'Settings',
    editProfile: 'Edit profile',
    avatar: 'Avatar',
    uploadAvatar: 'Upload avatar',
    changeAvatar: 'Change avatar',
    removeAvatar: 'Remove avatar',
    personalInfo: 'Personal information',
    contactInfo: 'Contact details',
    address: 'Address',
    phone: 'Phone',
    birthDate: 'Date of birth',
    nameDay: 'Name day',
    jerseyNumber: 'Jersey number',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    language: 'Language',
    role: 'Role',
    status: 'Status',
    player: 'Player',
    member: 'Member',
    sick: 'Sick',
    deleted: 'Deleted',
    init: 'Inactive'
  },
  errors: {
    network: 'Network error. Check your internet connection.',
    unauthorized: 'Unauthorised. Please sign in again.',
    forbidden: 'You are not allowed to do this.',
    notFound: 'The requested item was not found.',
    serverError: 'Server error. Please try again later.',
    validation: 'Please check the filled-in fields.',
    unknown: 'Unknown error.'
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
    const english = lang() === 'en'
    return (domain: string, code: string, fallback?: string): string => {
      const source = english ? EN_CAPTIONS : caps
      return (
        source[domain]?.[code] ??
        DEFAULT_CAPTIONS[domain]?.[code] ??
        fallback ??
        code
      )
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