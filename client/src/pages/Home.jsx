import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRoom } from '../context/RoomContext'

export default function Home() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { createRoom, joinRoom } = useRoom()

  // if arriving from a shared /room/XXX link that bounced back, pre-fill
  const prefilledCode = searchParams.get('room') || ''

  const [tab, setTab]           = useState(prefilledCode ? 'join' : 'create')
  const [username, setUsername] = useState('')
  const [roomCode, setRoomCode] = useState(prefilledCode.toUpperCase())
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (prefilledCode) {
      setTab('join')
      setRoomCode(prefilledCode.toUpperCase())
    }
  }, [prefilledCode])

  async function handleCreate(e) {
    e.preventDefault()
    if (!username.trim()) return setError('enter your name first')
    setLoading(true)
    setError('')
    try {
      const id = await createRoom(username.trim())
      sessionStorage.setItem('wt_username', username.trim())
      navigate(`/room/${id}`)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'failed to create room')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!username.trim()) return setError('enter your name first')
    if (!roomCode.trim()) return setError('enter a room code')
    setLoading(true)
    setError('')
    try {
      await joinRoom(roomCode.trim(), username.trim())
      sessionStorage.setItem('wt_username', username.trim())
      navigate(`/room/${roomCode.trim().toUpperCase()}`)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'could not join, check the code')
    } finally {
      setLoading(false)
    }
  }

  function switchTab(t) {
    setTab(t)
    setError('')
  }

  return (
    <div className="home-page">
      <div className="hero">
        <div className="logo-mark">
          <span className="logo-icon">▶</span>
        </div>
        <h1>WatchTogether</h1>
        <p className="tagline">watch youtube videos in sync with anyone</p>
      </div>

      <div className="card auth-card">
        <div className="tab-bar">
          <button
            className={`tab ${tab === 'create' ? 'active' : ''}`}
            onClick={() => switchTab('create')}
          >
            Create Room
          </button>
          <button
            className={`tab ${tab === 'join' ? 'active' : ''}`}
            onClick={() => switchTab('join')}
          >
            Join Room
          </button>
        </div>

        <form onSubmit={tab === 'create' ? handleCreate : handleJoin} className="auth-form">
          <div className="field">
            <label>your name</label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={30}
              autoFocus
            />
          </div>

          {tab === 'join' && (
            <div className="field">
              <label>room code</label>
              <input
                type="text"
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="code-input"
              />
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '...' : tab === 'create' ? 'Create Watch Party' : 'Join Watch Party'}
          </button>
        </form>
      </div>

      <div className="features">
        <div className="feature">
          <span className="feature-icon">⚡</span>
          <span>real-time sync</span>
        </div>
        <div className="feature">
          <span className="feature-icon">🎭</span>
          <span>host &amp; mod roles</span>
        </div>
        <div className="feature">
          <span className="feature-icon">💬</span>
          <span>live chat</span>
        </div>
      </div>
    </div>
  )
}
