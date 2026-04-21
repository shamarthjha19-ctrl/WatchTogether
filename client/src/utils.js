// pulls the video ID out of pretty much any youtube url format
export function extractVideoId(input) {
  if (!input) return null
  const str = input.trim()

  // already just an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str

  try {
    const url = new URL(str)

    // youtu.be/xxxxx
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1).split('?')[0] || null
    }

    if (url.hostname.includes('youtube.com')) {
      // regular watch url: ?v=xxxxx
      const v = url.searchParams.get('v')
      if (v) return v

      // embed / shorts: /embed/xxx or /shorts/xxx
      const match = url.pathname.match(/\/(embed|v|shorts)\/([a-zA-Z0-9_-]{11})/)
      if (match) return match[2]
    }
  } catch {
    // not a valid URL, try regex on the raw string
    const match = str.match(/(?:v=|\/embed\/|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/)
    if (match) return match[1]
  }

  return null
}

export function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function roleBadgeColor(role) {
  if (role === 'host') return '#f59e0b'
  if (role === 'moderator') return '#6366f1'
  return '#6b7280'
}

export function roleLabel(role) {
  if (role === 'host') return 'Host'
  if (role === 'moderator') return 'Mod'
  return 'Viewer'
}
