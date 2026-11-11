// User categories, shared by the roster and the attendance report.

import type { UserStatus } from './types'

export const USER_STATUSES: UserStatus[] = ['PLAYER', 'MEMBER', 'SICK', 'INIT', 'DELETED']

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PLAYER: 'Hráči',
  MEMBER: 'Členové',
  SICK: 'Nemocní',
  INIT: 'Neaktivní',
  DELETED: 'Smazaní'
}
