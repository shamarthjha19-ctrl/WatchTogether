import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Chat from '../components/Chat'
import ParticipantList from '../components/ParticipantList'
import VideoPlayer from '../components/VideoPlayer'
import { useRoom } from '../context/RoomContext'
import { useSocket } from '../context/SocketContext'

const NAME_KEY = 'wt_username'

export default function RoomPage() {
  const { roomId: urlRoomId } = useParams()
  const navigate  = useNavigate()
  const { connected } = useSocket()
  const { roomId, joinRoom, leaveRoom, kicked, myRole } = useRoom()

  const [tab, setTab]               = useState('people')
  const [copied, setCopied]         = useState(false)
  const [rejoinName, setRejoinName] = useState(
    () => sessionStorage.getItem(NAME_KEY) || ''
  )
  const [rejoinErr, setRejoinErr]   = useState('')
  const [rejoining, setRejoining]   = useState(false)
  const autoTriedRef = useRef(false)

  useEffect(() => {
    if (kicked) navigate('/', { replace: true })
  }, [kicked, navigate])

  // Auto-rejoin on refresh: when socket connects and we have a saved name,
  // join immediately without requiring the user to press a button.
  // Logic is inline (not calling handleRejoin) to avoid stale closure issues.
  useEffect(() => {
    if (roomId) return
    if (!connected) return
    if (autoTriedRef.current) return
    if (!urlRoomId) return
    const savedName = sessionStorage.getItem(NAME_KEY)
    if (!savedName?.trim()) return

    autoTriedRef.current = true
    setRejoining(true)
    setRejoinErr('')
    joinRoom(urlRoomId, savedName.trim())
      .then(() => {
        setRejoinName(savedName.trim())
      })
      .catch(err => {
        autoTriedRef.current = false
        setRejoinErr(typeof err === 'string' ? err : 'could not rejoin — room may have ended')
      })
      .finally(() => setRejoining(false))
  }, [connected, roomId, urlRoomId, joinRoom])

  async function handleRejoin(e) {
    e?.preventDefault()
    const name = rejoinName.trim()
    if (!name) return setRejoinErr('enter your name')
    setRejoining(true)
    setRejoinErr('')
    try {
      await joinRoom(urlRoomId, name)
      sessionStorage.setItem(NAME_KEY, name)
    } catch (err) {
      autoTriedRef.current = false
      setRejoinErr(typeof err === 'string' ? err : 'could not join — room may have ended')
    } finally {
      setRejoining(false)
    }
  }

  function handleLeave() {
    leaveRoom()
    navigate('/')
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyCode() {
    navigator.clipboard.writeText(roomId || urlRoomId || '').catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Show join/rejoin form whenever at /room/:id with no active session
  if (!roomId && urlRoomId) {
    const waiting = !connected || rejoining
    return (
      <div className="home-page">
        <div className="hero">
          <div className="logo-mark"><span>▶</span></div>
          <h1 style={{ fontSize: '1.8rem' }}>Join Room</h1>
          <p className="tagline">
            Room code:{' '}
            <strong style={{ color: 'var(--text)', letterSpacing: '0.1em' }}>
              {urlRoomId}
            </strong>
          </p>
        </div>
        <div className="card auth-card">
          <form className="auth-form" onSubmit={handleRejoin}>
            <div className="field">
              <label>your name</label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={rejoinName}
                autoFocus
                maxLength={30}
                onChange={e => setRejoinName(e.target.value)}
              />
            </div>
            {!connected && (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '4px 0' }}>
                ⏳ connecting to server...
              </p>
            )}
            {rejoinErr && <p className="error-msg">{rejoinErr}</p>}
            <button type="submit" className="btn-primary" disabled={waiting}>
              {rejoining ? 'joining...' : !connected ? 'connecting...' : 'Join Watch Party'}
            </button>
          </form>
          <button
            style={{
              marginTop: 12, background: 'none', border: 'none',
              color: 'var(--muted)', cursor: 'pointer', fontSize: '0.9rem', width: '100%',
            }}
            onClick={() => navigate('/')}
          >
            ← back to home
          </button>
        </div>
      </div>
    )
  }

  if (!roomId) return null

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="header-left">
          <span className="logo-sm">▶ WatchTogether</span>
          <div className="room-code-badge">
            <span>Room:</span>
            <strong>{roomId}</strong>
            <button className="copy-btn" onClick={copyCode} title="copy code">
              {copied ? '✓' : '⎘'}
            </button>
          </div>
          <button className="copy-link-btn" onClick={copyLink}>
            {copied ? '✓ copied!' : 'share link'}
          </button>
        </div>
        <div className="header-right">
          <span className={`role-pill ${myRole}`}>{myRole}</span>
          <button className="btn-leave" onClick={handleLeave}>leave</button>
        </div>
      </header>

      <div className="room-body">
        <main className="video-main">
          <VideoPlayer />
        </main>
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${tab === 'people' ? 'active' : ''}`}
              onClick={() => setTab('people')}
            >People</button>
            <button
              className={`sidebar-tab ${tab === 'chat' ? 'active' : ''}`}
              onClick={() => setTab('chat')}
            >Chat</button>
          </div>
          <div className="sidebar-content">
            {tab === 'people' ? <ParticipantList /> : <Chat />}
          </div>
        </aside>
      </div>
    </div>
  )
}
