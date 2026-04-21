import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ConnectionBanner from './components/ConnectionBanner'
import { RoomProvider } from './context/RoomContext'
import { SocketProvider } from './context/SocketContext'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Room from './pages/Room'
import './styles.css'

export default function App() {
  return (
    // FIX: BrowserRouter must wrap everything that uses routing hooks.
    // SocketProvider and RoomProvider are inside BrowserRouter so that
    // context consumers (e.g. Room.jsx using useNavigate) work correctly.
    <BrowserRouter>
      <SocketProvider>
        <RoomProvider>
          <ConnectionBanner />
          <Routes>
            <Route path="/"             element={<Home />} />
            <Route path="/room/:roomId" element={<Room />} />
            <Route path="*"             element={<NotFound />} />
          </Routes>
        </RoomProvider>
      </SocketProvider>
    </BrowserRouter>
  )
}
