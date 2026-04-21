import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoom } from '../context/RoomContext'
import { useYouTubePlayer } from '../hooks/useYouTubePlayer'
import { extractVideoId, formatTime } from '../utils'

const YT_PLAYING   = 1
const YT_PAUSED    = 2
const YT_BUFFERING = 3
const YT_CUED      = 5

const DRIFT_LIMIT = 3

export default function VideoPlayer() {
  const {
    roomId, myUserId, videoState, canControl, canLoadVideo,
    emitPlay, emitPause, emitSeek, emitChangeVideo, requestSync,
  } = useRoom()

  const [urlInput, setUrlInput]             = useState('')
  const [urlError, setUrlError]             = useState('')
  const [duration, setDuration]             = useState(0)
  const [currentDisplay, setCurrentDisplay] = useState(0)
  const [buffering, setBuffering]           = useState(false)

  // isProgrammatic: true while we are executing a programmatic YT command.
  // Any YT state-change events that fire during this window are ours — don't
  // echo them back to the server or we'll get an infinite loop.
  const isProgrammatic   = useRef(false)
  const seekTimer        = useRef(null)
  const playWhenReadyRef = useRef(false)

  const emitPlayRef  = useRef(emitPlay)
  const emitPauseRef = useRef(emitPause)
  useEffect(() => { emitPlayRef.current  = emitPlay  }, [emitPlay])
  useEffect(() => { emitPauseRef.current = emitPause }, [emitPause])

  const requestSyncRef = useRef(requestSync)
  useEffect(() => { requestSyncRef.current = requestSync }, [requestSync])

  function programmatic(fn, delayMs = 600) {
    isProgrammatic.current = true
    fn()
    setTimeout(() => { isProgrammatic.current = false }, delayMs)
  }

  const handleReady = useCallback(() => {
    requestSyncRef.current()
  }, [])

  const handleStateChange = useCallback(e => {
    if (e.data !== YT_BUFFERING) setBuffering(false)
    else setBuffering(true)

    // When the video starts buffering and we want autoplay, trigger play now
    if (e.data === YT_BUFFERING && playWhenReadyRef.current) {
      playWhenReadyRef.current = false
      e.target.playVideo()
    }

    if (e.data === YT_CUED || e.data === YT_PLAYING) {
      const dur = e.target.getDuration?.()
      if (dur > 0) setDuration(dur)
    }

    // Don't emit back to server if this event came from our own code
    if (isProgrammatic.current) return

    // Only hosts and mods emit playback events
    if (!canControl) return

    if (e.data === YT_PLAYING) {
      emitPlayRef.current(e.target.getCurrentTime())
    } else if (e.data === YT_PAUSED) {
      emitPauseRef.current(e.target.getCurrentTime())
    }
  }, [canControl])

  const {
    playerRef, playerReady,
    loadVideo, cueVideo, play, pause, seekTo, getTime, getState, getDuration,
  } = useYouTubePlayer({
    containerId:   'yt-player',
    onReady:       handleReady,
    onStateChange: handleStateChange,
  })

  useEffect(() => {
    if (roomId && playerReady) requestSyncRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerReady])

  // Apply remote videoState to the local player
  useEffect(() => {
    if (!playerReady) return

    const { videoId, playState, currentTime, initiator } = videoState
    if (!videoId) return

    const isMine    = initiator && myUserId && initiator === myUserId
    const currentId = playerRef.current?.getVideoData?.()?.video_id || ''
    const state     = getState()

    if (currentId !== videoId) {
      if (playState === 'playing') {
        playWhenReadyRef.current = true
        programmatic(() => loadVideo(videoId, currentTime), 2000)
      } else {
        programmatic(() => cueVideo(videoId, currentTime), 1200)
      }
      return
    }

    // Same video — only apply if someone else triggered it
    if (isMine) return

    const drift = Math.abs((getTime() ?? 0) - currentTime)

    if (playState === 'playing') {
      programmatic(() => {
        if (drift > DRIFT_LIMIT) {
          seekTo(currentTime)
          setCurrentDisplay(currentTime)
        }
        if (state !== YT_PLAYING) play()
      })
    } else if (playState === 'paused') {
      programmatic(() => {
        if (state === YT_PLAYING) pause()
        if (state === YT_CUED || drift > DRIFT_LIMIT) {
          seekTo(currentTime)
          setCurrentDisplay(currentTime)
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoState, playerReady])

  useEffect(() => {
    const id = setInterval(() => {
      if (!playerRef.current) return
      const t = getTime()
      setCurrentDisplay(t)
      const dur = getDuration()
      if (dur > 0) setDuration(d => d !== dur ? dur : d)
    }, 500)
    return () => clearInterval(id)
  }, [getTime, getDuration, playerRef])

  function handlePlayPauseClick() {
    if (!canControl) return
    const t     = getTime()
    const state = getState()
    if (state === YT_PLAYING) {
      programmatic(() => pause())
      emitPause(t)
    } else {
      programmatic(() => play())
      emitPlay(t)
    }
  }

  function handleSeekChange(e) {
    if (!canControl) return
    const t = parseFloat(e.target.value)
    programmatic(() => seekTo(t))
    setCurrentDisplay(t)
    clearTimeout(seekTimer.current)
    seekTimer.current = setTimeout(() => emitSeek(t), 300)
  }

  function handleVideoSubmit(e) {
    e.preventDefault()
    setUrlError('')
    const vid = extractVideoId(urlInput)
    if (!vid) return setUrlError('invalid youtube url')
    emitChangeVideo(vid)
    setUrlInput('')
  }

  const isPlaying = videoState.playState === 'playing'
  const hasVideo  = Boolean(videoState.videoId)

  return (
    <div className="video-section">

      {canLoadVideo && (
        <form className="url-bar" onSubmit={handleVideoSubmit}>
          <input
            type="text"
            className="url-input"
            placeholder="paste a youtube url..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
          />
          <button type="submit" className="btn-sm">Load</button>
          {urlError && <span className="url-error">{urlError}</span>}
        </form>
      )}

      <div className="player-wrapper">
        {!hasVideo && (
          <div className="player-placeholder">
            <div className="placeholder-inner">
              <span className="placeholder-icon">▶</span>
              <p>
                {canLoadVideo
                  ? 'paste a youtube link above to get started'
                  : 'waiting for the host to load a video...'}
              </p>
            </div>
          </div>
        )}

        <div id="yt-player" style={{ opacity: hasVideo ? 1 : 0, pointerEvents: hasVideo ? 'auto' : 'none' }} />

        {buffering && (
          <div className="buffering-overlay">
            <div className="spinner" />
          </div>
        )}

        {hasVideo && canControl && (
          <div
            className="player-overlay clickable"
            onClick={handlePlayPauseClick}
          />
        )}
      </div>

      {hasVideo && (
        <div className="controls-bar">
          <button
            className="control-btn"
            onClick={handlePlayPauseClick}
            disabled={!canControl}
            title={canControl ? undefined : 'only hosts and moderators can control playback'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <span className="time-label">{formatTime(currentDisplay)}</span>

          <input
            type="range"
            className="seek-bar"
            min="0"
            max={duration || 100}
            step="0.5"
            value={currentDisplay}
            onChange={handleSeekChange}
            disabled={!canControl}
            title={canControl ? undefined : 'only hosts and moderators can seek'}
          />

          <span className="time-label">{formatTime(duration)}</span>
        </div>
      )}
    </div>
  )
}
