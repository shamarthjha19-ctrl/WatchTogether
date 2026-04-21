import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="home-page">
      <div className="hero">
        <div className="logo-mark" style={{ fontSize: 32 }}>?</div>
        <h1 style={{ fontSize: '2rem' }}>Page not found</h1>
        <p className="tagline">this room might have ended or the link is wrong</p>
      </div>
      <button
        className="btn-primary"
        style={{ maxWidth: 260 }}
        onClick={() => navigate('/')}
      >
        back to home
      </button>
    </div>
  )
}
