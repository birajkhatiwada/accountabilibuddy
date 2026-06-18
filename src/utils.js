// Returns the Monday of the current week as YYYY-MM-DD (used as week ID)
export function getCurrentWeekId(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  // Shift so week starts Monday (0=Mon ... 6=Sun)
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export function formatWeekLabel(weekId) {
  const start = new Date(weekId + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

export function formatTimestamp(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
