// API types, aligned with the live responses from https://dev.tymy.cz/api

export interface ApiResponse<T> {
  status: 'OK' | 'ERROR'
  data?: T
  message?: string
  statusMessage?: string
}

export type UserStatus = 'PLAYER' | 'MEMBER' | 'SICK' | 'DELETED' | 'INIT'
export type Gender = 'MALE' | 'FEMALE' | 'UNKNOWN'

/** Compact user shape embedded in attendance, posts and history. */
export interface UserSummary {
  id: number
  login: string
  callName: string
  pictureUrl: string
  gender?: Gender
  status?: UserStatus
  displayName?: string
}

export interface User {
  id: number
  login: string
  canLogin: boolean
  canEditCallName: boolean
  createdAt: string
  lastLogin?: string | null
  status: UserStatus
  roles: string[]
  firstName: string
  lastName: string
  callName: string
  language: 'CZ' | 'EN'
  email: string | null
  jerseyNumber: string | null
  gender: Gender
  street: string | null
  city: string | null
  zipCode: string | null
  phone: string | null
  phone2: string | null
  birthDate?: string | null
  nameDayMonth: number
  nameDayDay: number
  pictureUrl: string
  rolesAsString: string
  fullName: string
  displayName: string
}

export interface LoginResponse {
  sessionKey: string
  data: User
}

// ============================================
// Events
// ============================================

export type EventTypeCode = 'TRA' | 'RUN' | 'MEE' | 'TOU' | 'CMP'

export interface AttendanceStatus {
  id: number
  code: string
  caption: string
  /** Raw RGB hex without '#', e.g. "5cb85c". */
  color?: string
  icon?: string
  order?: number
  statusSetId?: number
}

export interface EventType {
  id: number
  code: EventTypeCode
  caption: string
  /** Raw RGB hex without '#'. */
  color?: string
  preStatusSetId: number
  postStatusSetId: number
  preStatusSet: AttendanceStatus[]
  postStatusSet: AttendanceStatus[]
  mandatory?: string
  order?: number
}

export interface Attendance {
  userId: number
  eventId: number
  /** Status code, e.g. "YES" / "NO" / "LAT". */
  preStatus?: string | null
  preStatusId?: number | null
  preDescription?: string | null
  preUserMod?: number | null
  preDatMod?: string | null
  postStatus?: string | null
  postStatusId?: number | null
  postDescription?: string | null
  postUserMod?: number | null
  postDatMod?: string | null
  user?: UserSummary
}

export interface AttendanceHistory {
  eventId: number
  userId: number
  updatedAt: string
  updatedById: number
  preStatusFrom?: string | null
  preDescFrom?: string | null
  preStatusTo?: string | null
  preDescTo?: string | null
  statusIdFrom?: number | null
  statusIdTo?: number | null
  entryType?: string
  user?: UserSummary
  updatedBy?: UserSummary
}

export interface Event {
  id: number
  created?: string
  createdUserId?: number
  caption: string
  eventTypeId?: number
  type: EventTypeCode
  description: string
  closeTime: string
  startTime: string
  endTime: string
  link: string
  place: string
  viewRightName?: string | null
  planRightName?: string | null
  resultRightName?: string | null
  canView: boolean
  canPlan: boolean
  canPlanOthers?: boolean
  canResult: boolean
  inPast: boolean
  inFuture: boolean
  attendance?: Attendance[]
  eventType?: EventType
  /** Not returned by the API; kept for locally-derived state. */
  myAttendance?: Attendance
}

// ============================================
// Discussions
// ============================================

export interface Discussion {
  id: number
  caption: string
  description: string
  readRightName: string | null
  writeRightName: string | null
  deleteRightName: string | null
  stickyRightName: string | null
  publicRead: boolean
  status: 'ACTIVE' | 'INACTIVE'
  editablePosts: boolean
  order: number
  canRead: boolean
  canWrite: boolean
  canDelete: boolean
  canStick: boolean
  newPosts: number
  numberOfPosts?: number
  newInfo?: {
    discussionId: number
    newsCount: number
    lastVisit: string
  }
}

export interface DiscussionDetail extends Discussion {
  numberOfPosts: number
}

export interface DiscussionPost {
  id: number
  discussionId: number
  post: string
  /** Null for posts whose author no longer exists (system/AUTOTEST posts). */
  createdById: number | null
  createdAt: string
  updatedById?: number | null
  updatedAt?: string | null
  sticky: boolean
  newPost: boolean
  /** Fallback author label when `createdBy` is null. */
  userName?: string | null
  reactions?: Record<string, number[]>
  createdAtStr: string
  updatedAtStr?: string | null
  createdBy: UserSummary | null
}

export interface DiscussionPage {
  discussion: DiscussionDetail
  paging: {
    currentPage: number
    numberOfPages: number
  }
  posts: DiscussionPost[]
}

// ============================================
// Polls
// ============================================

export interface PollOption {
  id: number
  pollId: number
  caption: string
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN'
}

export interface PollVote {
  pollId: number
  userId: number
  optionId: number
  stringValue?: string | null
  numericValue?: number | null
  booleanValue?: boolean | null
  updatedById?: number | null
  updatedAt?: string | null
  /** Some deployments embed the voter (like attendance does); optional. */
  user?: UserSummary
}

export interface Poll {
  id: number
  createdById: number
  createdAt: string
  updatedById: number | null
  updatedAt: string
  caption: string
  description: string
  descriptionHtml: string
  minItems?: number
  maxItems?: number
  changeableVotes: boolean
  mainMenu: boolean
  anonymousResults: boolean
  showResults: 'ALWAYS' | 'NEVER' | 'AFTER_VOTE'
  status: 'DESIGN' | 'OPENED' | 'CLOSED'
  resultRightName: string | null
  voteRightName: string | null
  alienVoteRightName: string | null
  orderFlag: number
  options?: PollOption[]
  votes?: PollVote[]
  canSeeResults: boolean
  canVote: boolean
  canAlienVote: boolean
  voted: boolean
}

// ============================================
// Notes
// ============================================

export interface Note {
  id: number
  createdById: number
  createdAt: string
  updatedById: number
  updatedAt: string
  caption: string
  description: string
  source: string
  accessType: 'PUBLIC' | 'PRIVATE'
  menuType: 'NO' | 'TOP' | 'LEFT'
  specialPage: 'LOGIN' | 'WELCOME' | ''
  menuOrder: number
  readCounter: number
  updateCounter: number
  version: number
  canRead: boolean
  canWrite: boolean
}

// ============================================
// Misc
// ============================================

export interface LiveUser {
  id: number
  login: string
  callName: string
  pictureUrl: string
  gender: Gender
  status: UserStatus
}

export interface Caption {
  domain: string
  code: string
  value: string
  language: string
}

export interface CaptionsCollection {
  status: string
  data: Caption[]
}
