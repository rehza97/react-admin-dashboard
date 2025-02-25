let eventGuid = 0
let todayStr = new Date().toISOString().replace(/T.*$/, '') // YYYY-MM-DD of today

// Remove initial events
export const INITIAL_EVENTS = [] // Set to an empty array

export function createEventId() {
  return String(eventGuid++)
}
