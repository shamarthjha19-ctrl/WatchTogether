import { useSocket } from '../context/SocketContext'

export default function ConnectionBanner() {
  const { connected } = useSocket()
  if (connected) return null

  return (
    <div className="conn-banner">
      <span className="conn-dot" />
      reconnecting to server...
    </div>
  )
}
