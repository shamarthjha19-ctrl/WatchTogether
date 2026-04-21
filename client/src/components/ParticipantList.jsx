import { useState } from 'react'
import { useRoom } from '../context/RoomContext'
import { roleBadgeColor, roleLabel } from '../utils'

export default function ParticipantList() {
  const { participants, myUserId, isHost, assignRole, removeParticipant } = useRoom()
  const [openMenuFor, setOpenMenuFor] = useState(null)
  const [err, setErr] = useState('')

  async function handleRoleChange(userId, role) {
    setErr('')
    try {
      await assignRole(userId, role)
    } catch (e) {
      setErr(typeof e === 'string' ? e : 'something went wrong')
    }
    setOpenMenuFor(null)
  }

  async function handleKick(userId) {
    setErr('')
    try {
      await removeParticipant(userId)
    } catch (e) {
      setErr(typeof e === 'string' ? e : 'could not remove user')
    }
    setOpenMenuFor(null)
  }

  return (
    <div className="participant-list">
      <div className="sidebar-header">
        <h3>Participants <span className="count">{participants.length}</span></h3>
      </div>

      {err && <p className="error-msg small">{err}</p>}

      <ul className="plist">
        {participants.map(p => (
          <li key={p.userId} className={`pitem ${p.userId === myUserId ? 'me' : ''}`}>
            <div className="pitem-left">
              <div className="avatar" style={{ background: nameToColor(p.username) }}>
                {p.username[0].toUpperCase()}
              </div>
              <div className="pitem-info">
                <span className="pname">
                  {p.username}{p.userId === myUserId ? ' (you)' : ''}
                </span>
                <span
                  className="role-badge"
                  style={{
                    background: roleBadgeColor(p.role) + '22',
                    color: roleBadgeColor(p.role)
                  }}
                >
                  {roleLabel(p.role)}
                </span>
              </div>
            </div>

            {isHost && p.userId !== myUserId && (
              <div className="pitem-actions">
                {openMenuFor === p.userId ? (
                  <div className="action-menu">
                    {p.role !== 'moderator' && (
                      <button
                        className="action-btn promote"
                        onClick={() => handleRoleChange(p.userId, 'moderator')}
                      >
                        make mod
                      </button>
                    )}
                    {p.role !== 'participant' && (
                      <button
                        className="action-btn demote"
                        onClick={() => handleRoleChange(p.userId, 'participant')}
                      >
                        make viewer
                      </button>
                    )}
                    <button
                      className="action-btn transfer"
                      onClick={() => handleRoleChange(p.userId, 'host')}
                    >
                      make host
                    </button>
                    <button
                      className="action-btn remove"
                      onClick={() => handleKick(p.userId)}
                    >
                      kick
                    </button>
                    <button
                      className="action-btn cancel"
                      onClick={() => setOpenMenuFor(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="icon-btn"
                    onClick={() => setOpenMenuFor(p.userId)}
                    title="manage user"
                  >
                    ⋯
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function nameToColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 42%)`
}
