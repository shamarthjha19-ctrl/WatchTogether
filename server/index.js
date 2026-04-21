require('dotenv').config()

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')

const app = express()
const server = http.createServer(app)

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
})

app.use(cors({ origin: CLIENT_URL }))
app.use(express.json())


class Participant {
  constructor(socketId, username, role = 'participant') {
    this.socketId = socketId
    this.userId = uuidv4()
    this.username = username
    this.role = role
    this.joinedAt = Date.now()
  }

  // Host and moderators can control playback (play/pause/seek/change video)
  canControl() {
    return this.role === 'host' || this.role === 'moderator'
  }

  // Only the host can manage roles and remove people
  canManageRoom() {
    return this.role === 'host'
  }

  toJSON() {
    return {
      socketId: this.socketId,
      userId: this.userId,
      username: this.username,
      role: this.role,
    }
  }
}


class Room {
  constructor(roomId, hostSocketId, hostUsername) {
    this.roomId = roomId
    this.createdAt = Date.now()
    this.participants = new Map()
    this.videoState = {
      videoId: '',
      playState: 'paused',
      currentTime: 0,
      updatedAt: Date.now(),
    }
    this.chatMessages = []

    const host = new Participant(hostSocketId, hostUsername, 'host')
    this.participants.set(hostSocketId, host)
    this.hostUserId = host.userId
  }

  addParticipant(socketId, username) {
    const p = new Participant(socketId, username, 'participant')
    this.participants.set(socketId, p)
    return p
  }

  removeParticipant(socketId) {
    const leaving = this.participants.get(socketId)
    this.participants.delete(socketId)

    // If the host left and there are still people in the room, promote the next person
    if (leaving?.role === 'host' && this.participants.size > 0) {
      const next = this.participants.values().next().value
      next.role = 'host'
      this.hostUserId = next.userId
      return { left: leaving, newHost: next }
    }

    return { left: leaving, newHost: null }
  }

  getBySocket(socketId) {
    return this.participants.get(socketId)
  }

  getByUserId(userId) {
    for (const p of this.participants.values()) {
      if (p.userId === userId) return p
    }
    return null
  }

  assignRole(targetUserId, newRole, requesterSocketId) {
    const requester = this.getBySocket(requesterSocketId)
    if (!requester?.canManageRoom()) {
      return { error: 'only the host can assign roles' }
    }

    const target = this.getByUserId(targetUserId)
    if (!target) return { error: 'user not found' }

    // Transferring host — the old host becomes a moderator
    if (newRole === 'host') {
      requester.role = 'moderator'
      this.hostUserId = target.userId
    }

    target.role = newRole
    return { target }
  }

  listParticipants() {
    return Array.from(this.participants.values()).map(p => p.toJSON())
  }

  updateVideoState(changes) {
    this.videoState = { ...this.videoState, ...changes, updatedAt: Date.now() }
  }

  addMessage(socketId, text) {
    const p = this.getBySocket(socketId)
    if (!p) return null

    const msg = {
      id: uuidv4(),
      userId: p.userId,
      username: p.username,
      message: text,
      timestamp: Date.now(),
    }

    this.chatMessages.push(msg)
    if (this.chatMessages.length > 200) this.chatMessages.shift()
    return msg
  }

  isEmpty() {
    return this.participants.size === 0
  }
}


class RoomManager {
  constructor() {
    this.rooms = new Map()
  }

  create(hostSocketId, hostUsername) {
    const id = this._generateCode()
    const room = new Room(id, hostSocketId, hostUsername)
    this.rooms.set(id, room)
    return room
  }

  get(roomId) {
    return this.rooms.get(roomId?.toUpperCase())
  }

  delete(roomId) {
    this.rooms.delete(roomId)
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code
    do {
      code = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('')
    } while (this.rooms.has(code))
    return code
  }
}


class MessageHandler {
  constructor(io, rooms) {
    this.io = io
    this.rooms = rooms
    this.socketRoom = new Map() // socketId → roomId
  }

  attach(socket) {
    console.log('socket connected:', socket.id)

    socket.on('create_room', (data, cb) => this.onCreate(socket, data, cb))
    socket.on('join_room', (data, cb) => this.onJoin(socket, data, cb))
    socket.on('leave_room', () => this.onLeave(socket))
    socket.on('disconnect', () => this.onLeave(socket))

    socket.on('play', data => this.onPlay(socket, data))
    socket.on('pause', data => this.onPause(socket, data))
    socket.on('seek', data => this.onSeek(socket, data))
    socket.on('change_video', data => this.onChangeVideo(socket, data))

    socket.on('assign_role', (data, cb) => this.onAssignRole(socket, data, cb))
    socket.on('remove_participant', (data, cb) => this.onKick(socket, data, cb))
    socket.on('request_sync', (_, cb) => this.onRequestSync(socket, cb))
    socket.on('chat_message', data => this.onChat(socket, data))
  }

  onCreate(socket, { username } = {}, cb) {
    if (!username?.trim()) return cb?.({ error: 'username is required' })

    const room = this.rooms.create(socket.id, username.trim())
    this.socketRoom.set(socket.id, room.roomId)
    socket.join(room.roomId)

    const me = room.getBySocket(socket.id)
    cb?.({
      roomId: room.roomId,
      userId: me.userId,
      role: 'host',
      participants: room.listParticipants(),
      videoState: room.videoState,
    })

    console.log(`[${room.roomId}] created by ${username}`)
  }

  onJoin(socket, { roomId, username } = {}, cb) {
    if (!roomId || !username?.trim()) {
      return cb?.({ error: 'roomId and username are required' })
    }

    const room = this.rooms.get(roomId)
    if (!room) return cb?.({ error: 'room not found' })

    // Clean up any previous room this socket was in
    const existing = this.socketRoom.get(socket.id)
    if (existing && existing !== roomId.toUpperCase()) this.onLeave(socket)

    const p = room.addParticipant(socket.id, username.trim())
    this.socketRoom.set(socket.id, room.roomId)
    socket.join(room.roomId)

    cb?.({
      roomId: room.roomId,
      userId: p.userId,
      role: p.role,
      participants: room.listParticipants(),
      videoState: room.videoState,
    })

    socket.to(room.roomId).emit('user_joined', {
      username: p.username,
      userId: p.userId,
      role: p.role,
      participants: room.listParticipants(),
    })

    console.log(`[${room.roomId}] ${username} joined`)
  }

  onLeave(socket) {
    const roomId = this.socketRoom.get(socket.id)
    if (!roomId) return

    const room = this.rooms.get(roomId)
    if (!room) return

    const { left, newHost } = room.removeParticipant(socket.id)
    this.socketRoom.delete(socket.id)
    socket.leave(roomId)

    if (room.isEmpty()) {
      this.rooms.delete(roomId)
      console.log(`[${roomId}] closed — no participants left`)
      return
    }

    // If the host left and someone was auto-promoted, broadcast the role change
    if (newHost) {
      this.io.to(roomId).emit('role_assigned', {
        userId: newHost.userId,
        username: newHost.username,
        role: newHost.role,
        participants: room.listParticipants(),
      })
    }

    this.io.to(roomId).emit('user_left', {
      username: left?.username,
      userId: left?.userId,
      participants: room.listParticipants(),
      newHost: newHost ? newHost.toJSON() : null,
    })
  }

  onPlay(socket, data) {
    const { room, p } = this.getContext(socket)
    if (!room || !p) return
    if (!p.canControl()) return // participants are watch-only

    room.updateVideoState({
      playState: 'playing',
      currentTime: data?.currentTime ?? room.videoState.currentTime,
    })
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState, initiator: p.userId })
  }

  onPause(socket, data) {
    const { room, p } = this.getContext(socket)
    if (!room || !p) return
    if (!p.canControl()) return

    room.updateVideoState({
      playState: 'paused',
      currentTime: data?.currentTime ?? room.videoState.currentTime,
    })
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState, initiator: p.userId })
  }

  onSeek(socket, data) {
    const { room, p } = this.getContext(socket)
    if (!room || !p) return
    if (!p.canControl()) return

    if (data?.time != null) {
      room.updateVideoState({ currentTime: data.time })
    }
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState, initiator: p.userId })
  }

  onChangeVideo(socket, { videoId } = {}) {
    const { room, p } = this.getContext(socket)
    if (!room || !p) return
    if (!p.canControl() || !videoId) return

    room.updateVideoState({ videoId, playState: 'paused', currentTime: 0 })
    this.io.to(room.roomId).emit('sync_state', { ...room.videoState, initiator: p.userId })
  }

  onAssignRole(socket, { userId, role } = {}, cb) {
    const { room, p } = this.getContext(socket)
    if (!room) return cb?.({ error: 'not in a room' })

    if (!['host', 'moderator', 'participant'].includes(role)) {
      return cb?.({ error: 'invalid role' })
    }

    const result = room.assignRole(userId, role, socket.id)
    if (result.error) return cb?.({ error: result.error })

    cb?.({ success: true })
    this.io.to(room.roomId).emit('role_assigned', {
      userId: result.target.userId,
      username: result.target.username,
      role: result.target.role,
      participants: room.listParticipants(),
    })
  }

  onKick(socket, { userId } = {}, cb) {
    const { room, p } = this.getContext(socket)
    if (!room) return cb?.({ error: 'not in a room' })
    if (!p?.canManageRoom()) return cb?.({ error: 'only the host can remove participants' })

    const target = room.getByUserId(userId)
    if (!target) return cb?.({ error: 'user not found' })
    if (target.role === 'host') return cb?.({ error: "can't remove the host" })

    const targetSocket = this.io.sockets.sockets.get(target.socketId)
    targetSocket?.emit('kicked', { reason: 'you were removed by the host' })
    targetSocket?.leave(room.roomId)

    room.removeParticipant(target.socketId)
    this.socketRoom.delete(target.socketId)

    cb?.({ success: true })
    this.io.to(room.roomId).emit('participant_removed', {
      userId: target.userId,
      participants: room.listParticipants(),
    })
  }

  onRequestSync(socket, cb) {
    const { room } = this.getContext(socket)
    if (!room) return cb?.({ error: 'not in a room' })
    cb?.({ videoState: room.videoState })
  }

  onChat(socket, { message } = {}) {
    const { room } = this.getContext(socket)
    if (!room || !message?.trim()) return

    const msg = room.addMessage(socket.id, message.trim().slice(0, 500))
    if (msg) this.io.to(room.roomId).emit('chat_message', msg)
  }

  getContext(socket) {
    const roomId = this.socketRoom.get(socket.id)
    const room = roomId ? this.rooms.get(roomId) : null
    const p = room ? room.getBySocket(socket.id) : null
    return { room, p }
  }
}


const roomManager = new RoomManager()
const handler = new MessageHandler(io, roomManager)

io.on('connection', socket => handler.attach(socket))

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: roomManager.rooms.size, uptime: process.uptime() })
})

app.get('/room/:id', (req, res) => {
  const room = roomManager.get(req.params.id)
  if (!room) return res.status(404).json({ error: 'room not found' })
  res.json({ roomId: room.roomId, participants: room.listParticipants().length })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`server running on http://localhost:${PORT}`))
