// Date filter utilities for Tymy API

/**
 * Formats a Date to the Tymy API format: YYYYMMDDHHmmss
 * This is the most reliable format according to the API docs
 */
export function formatApiDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

/**
 * Formats a Date to YYYYMMDD (date only)
 */
export function formatApiDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

/**
 * Formats a Date to HHmmss (time only)
 */
export function formatApiTimeOnly(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}${minutes}${seconds}`
}

/**
 * Parses various date formats that the API might return
 * API returns ISO strings like "2017-12-18T17:00:00.000Z"
 */
export function parseApiDate(dateString: string): Date {
  const isoDate = new Date(dateString)
  if (!isNaN(isoDate.getTime())) {
    return isoDate
  }
  
  return new Date(dateString)
}

/**
 * Creates a filter condition for the API
 */
export interface DateFilter {
  field: string
  operator: '>' | '<' | '=' | '!=' | '>=' | '<='
  value: Date
}

/**
 * Builds filter string for events API
 * Example: "startTime>20240101~endTime<20241231"
 */
export function buildDateFilterString(filters: DateFilter[]): string {
  return filters
    .map(f => `${f.field}${f.operator}${formatApiDate(f.value)}`)
    .join('~')
}

/**
 * Common filter presets
 */
export const EventFilters = {
  // Upcoming events (start time in future)
  upcoming: (now: Date = new Date()): DateFilter[] => [
    { field: 'startTime', operator: '>=', value: now }
  ],
  
  // Past events (end time in past)
  past: (now: Date = new Date()): DateFilter[] => [
    { field: 'endTime', operator: '<', value: now }
  ],
  
  // Events in a specific month
  inMonth: (year: number, month: number): DateFilter[] => {
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0, 23, 59, 59)
    return [
      { field: 'startTime', operator: '>=', value: start },
      { field: 'startTime', operator: '<=', value: end }
    ]
  },
  
  // Events in a date range
  inRange: (start: Date, end: Date): DateFilter[] => [
    { field: 'startTime', operator: '>=', value: start },
    { field: 'startTime', operator: '<=', value: end }
  ],
  
  // Events by type
  byType: (type: string): DateFilter[] => [
    { field: 'type', operator: '=', value: new Date(type) } // Will be converted to string in buildFilterString
  ],
  
  // Events this week
  thisWeek: (now: Date = new Date()): DateFilter[] => {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay()) // Sunday
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    
    return [
      { field: 'startTime', operator: '>=', value: start },
      { field: 'startTime', operator: '<=', value: end }
    ]
  },
  
  // Events this month
  thisMonth: (now: Date = new Date()): DateFilter[] => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    return [
      { field: 'startTime', operator: '>=', value: start },
      { field: 'startTime', operator: '<=', value: end }
    ]
  }
}

/**
 * Combines multiple filter arrays
 */
export function combineFilters(...filterArrays: DateFilter[][]): DateFilter[] {
  return filterArrays.flat()
}

/**
 * Converts DateFilter array to API query string
 * Note: For 'type' field, we need special handling since it's a string not a date
 */
export function filtersToQueryString(filters: DateFilter[]): string {
  return filters
    .map(f => {
      // Special handling for non-date fields
      if (f.field === 'type') {
        return `${f.field}${f.operator}${f.value.toString()}`
      }
      return `${f.field}${f.operator}${formatApiDate(f.value)}`
    })
    .join('~')
}

/**
 * Format date for display in Czech locale
 */
export function formatDisplayDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === 'string' ? parseApiDate(date) : date
  return d.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options
  })
}

/**
 * Format time for display
 */
export function formatDisplayTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseApiDate(date) : date
  return d.toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format date and time for display
 */
export function formatDisplayDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseApiDate(date) : date
  return `${formatDisplayDate(d)} ${formatDisplayTime(d)}`
}

/**
 * Relative time (e.g., "před 2 hodinami", "za 3 dny")
 */
export function formatRelativeTime(date: Date | string, base: Date = new Date()): string {
  const d = typeof date === 'string' ? parseApiDate(date) : date
  const diffMs = d.getTime() - base.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)
  
  if (Math.abs(diffMins) < 1) return 'právě teď'
  if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `za ${diffMins} min` : `před ${Math.abs(diffMins)} min`
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `za ${diffHours} hod` : `před ${Math.abs(diffHours)} hod`
  }
  if (Math.abs(diffDays) < 30) {
    return diffDays > 0 ? `za ${diffDays} dnů` : `před ${Math.abs(diffDays)} dny`
  }
  
  return formatDisplayDate(d)
}

/**
 * Check if event is in past
 */
export function isEventPast(event: { endTime: string }): boolean {
  return parseApiDate(event.endTime) < new Date()
}

/**
 * Check if event is upcoming
 */
export function isEventUpcoming(event: { startTime: string }): boolean {
  return parseApiDate(event.startTime) > new Date()
}

/**
 * Check if event is happening now
 */
export function isEventNow(event: { startTime: string; endTime: string }): boolean {
  const now = new Date()
  const start = parseApiDate(event.startTime)
  const end = parseApiDate(event.endTime)
  return start <= now && end >= now
}

/**
 * Get event status for display
 */
export function getEventStatus(event: { startTime: string; endTime: string; closeTime: string }): 'upcoming' | 'open' | 'ongoing' | 'closed' | 'past' {
  const now = new Date()
  const start = parseApiDate(event.startTime)
  const end = parseApiDate(event.endTime)
  const close = parseApiDate(event.closeTime)
  
  if (now < close) return 'open'
  if (now >= start && now <= end) return 'ongoing'
  if (now < start) return 'upcoming'
  if (now > end) return 'past'
  return 'closed'
}