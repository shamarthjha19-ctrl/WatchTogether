import { useEffect, useRef, useState } from 'react'
import { useRoom } from '../context/RoomContext'

export default function Chat() {
  const { chatMessages, sendChatMessage, myUserId } = useRoom()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    sendChatMessage(input.trim())
    setInput('')
  }

  return (
    <div className="chat-panel">
      <div className="sidebar-header">
        <h3>Chat</h3>
      </div>

      <div className="chat-messages">
        {chatMessages.length === 0 && (
          <p className="chat-empty">no messages yet</p>
        )}
        {chatMessages.map(msg => (
          <div key={msg.id} className={`chat-msg ${msg.userId === myUserId ? 'mine' : ''}`}>
            <span className="chat-author" style={{ color: nameColor(msg.username) }}>
              {msg.username}
            </span>
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="say something..."
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={500}
        />
        <button type="submit" className="btn-sm">Send</button>
      </form>
    </div>
  )
}

function nameColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 55%)`
}
