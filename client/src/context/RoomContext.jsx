import { useCallback, useContext, useEffect, useRef, useState, createContext } from 'react'
import { useSocket } from './SocketContext'

const RoomContext = createContext(null)

export function RoomProvider({ children }) {
  const { socket, connected } = useSocket()

  const [roomId, setRoomId]             = useState(null)
  const [myUserId, setMyUserId]         = useState(null)
  const [myRole, setMyRole]             = useState(null)
  const [participants, setParticipants] = useState([])
  const [videoState, setVideoState]     = useState({
    videoId: '', playState: 'paused', currentTime: 0,
  })
  const [chatMessages, setChatMessages] = useState([])
  const [kicked, setKicked]             = useState(false)

  // Only hosts and moderators can control playback
  const canControl   = myRole === 'host' || myRole === 'moderator'
  const canLoadVideo = myRole === 'host' || myRole === 'moderator'
  const isHost       = myRole === 'host'

  const myUserIdRef = useRef(myUserId)
  useEffect(() => { myUserIdRef.current = myUserId }, [myUserId])

  const clearRoomRef = useRef(null)
  clearRoomRef.current = () => {
    setRoomId(null); setMyUserId(null); setMyRole(null)
    setParticipants([]); setVideoState({ videoId: '', playState: 'paused', currentTime: 0 })
    setChatMessages([])
  }

  useEffect(() => {
    const s = socket.current
    if (!s || !connected) return

    const onUserJoined         = ({ participants }) => setParticipants(participants)
    const onUserLeft           = ({ participants }) => setParticipants(participants)
    const onParticipantRemoved = ({ participants }) => setParticipants(participants)

    const onRoleAssigned = ({ userId, role, participants }) => {
      setParticipants(participants)
      if (userId === myUserIdRef.current) setMyRole(role)
    }

    const onKicked = () => {
      setKicked(true)
      clearRoomRef.current()
    }

    const onSyncState = ({ videoId, playState, currentTime, initiator }) => {
      setVideoState({ videoId, playState, currentTime, initiator })
    }

    const onChatMessage = msg => {
      setChatMessages(prev => [...prev.slice(-199), msg])
    }

    s.on('user_joined',         onUserJoined)
    s.on('user_left',           onUserLeft)
    s.on('role_assigned',       onRoleAssigned)
    s.on('participant_removed', onParticipantRemoved)
    s.on('kicked',              onKicked)
    s.on('sync_state',          onSyncState)
    s.on('chat_message',        onChatMessage)

    return () => {
      s.off('user_joined',         onUserJoined)
      s.off('user_left',           onUserLeft)
      s.off('role_assigned',       onRoleAssigned)
      s.off('participant_removed', onParticipantRemoved)
      s.off('kicked',              onKicked)
      s.off('sync_state',          onSyncState)
      s.off('chat_message',        onChatMessage)
    }
  }, [connected, socket])

  const createRoom = useCallback((username) => new Promise((resolve, reject) => {
    const s = socket.current
    if (!s?.connected) return reject('not connected to server')
    s.emit('create_room', { username }, res => {
      if (res.error) return reject(res.error)
      setRoomId(res.roomId); setMyUserId(res.userId); setMyRole(res.role)
      setParticipants(res.participants); setVideoState(res.videoState); setKicked(false)
      resolve(res.roomId)
    })
  }), [socket])

  const joinRoom = useCallback((roomId, username) => new Promise((resolve, reject) => {
    const s = socket.current
    if (!s?.connected) return reject('not connected to server')
    s.emit('join_room', { roomId: roomId.toUpperCase(), username }, res => {
      if (res.error) return reject(res.error)
      setRoomId(res.roomId); setMyUserId(res.userId); setMyRole(res.role)
      setParticipants(res.participants); setVideoState(res.videoState); setKicked(false)
      resolve(res)
    })
  }), [socket])

  const leaveRoom = useCallback(() => {
    socket.current?.emit('leave_room')
    clearRoomRef.current()
  }, [socket])

  const emitPlay  = useCallback(t => socket.current?.emit('play',  { currentTime: t }), [socket])
  const emitPause = useCallback(t => socket.current?.emit('pause', { currentTime: t }), [socket])
  const emitSeek  = useCallback(t => socket.current?.emit('seek',  { time: t }),        [socket])

  const emitChangeVideo = useCallback(videoId => {
    socket.current?.emit('change_video', { videoId })
  }, [socket])

  const assignRole = useCallback((userId, role) => new Promise((resolve, reject) => {
    socket.current?.emit('assign_role', { userId, role }, res => {
      if (res?.error) reject(res.error); else resolve()
    })
  }), [socket])

  const removeParticipant = useCallback(userId => new Promise((resolve, reject) => {
    socket.current?.emit('remove_participant', { userId }, res => {
      if (res?.error) reject(res.error); else resolve()
    })
  }), [socket])

  const sendChatMessage = useCallback(message => {
    socket.current?.emit('chat_message', { message })
  }, [socket])

  const requestSync = useCallback(() => new Promise(resolve => {
    const s = socket.current
    if (!s?.connected) return resolve(null)
    s.emit('request_sync', {}, res => {
      if (res?.videoState) { setVideoState(res.videoState); resolve(res.videoState) }
      else resolve(null)
    })
  }), [socket])

  return (
    <RoomContext.Provider value={{
      roomId, myUserId, myRole, participants, videoState, chatMessages, kicked,
      canControl, canLoadVideo, isHost,
      createRoom, joinRoom, leaveRoom,
      emitPlay, emitPause, emitSeek, emitChangeVideo,
      assignRole, removeParticipant, sendChatMessage, requestSync,
      setVideoState,
    }}>
      {children}
    </RoomContext.Provider>
  )
}

export const useRoom = () => useContext(RoomContext)
