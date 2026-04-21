import { useCallback, useEffect, useRef, useState } from 'react'

let ytApiReady = false
let waitingCallbacks = []

function loadYTScript() {
  if (window.YT?.Player) { ytApiReady = true; return }
  if (document.getElementById('yt-iframe-api')) return

  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true
    waitingCallbacks.forEach(cb => cb())
    waitingCallbacks = []
  }

  const tag = document.createElement('script')
  tag.id  = 'yt-iframe-api'
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)
}

export function useYouTubePlayer({ containerId, onReady, onStateChange }) {
  const playerRef = useRef(null)
  const [playerReady, setPlayerReady] = useState(false)

  const onReadyRef       = useRef(onReady)
  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => { onReadyRef.current = onReady },             [onReady])
  useEffect(() => { onStateChangeRef.current = onStateChange }, [onStateChange])

  const initPlayer = useCallback(() => {
    if (!document.getElementById(containerId)) return
    if (playerRef.current) {
      try { playerRef.current.destroy() } catch (_) {}
      playerRef.current = null
    }
    playerRef.current = new window.YT.Player(containerId, {
      height: '100%',
      width:  '100%',
      playerVars: {
        autoplay: 0, controls: 0, disablekb: 1,
        modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0, playsinline: 1,
      },
      events: {
        onReady: e => { setPlayerReady(true); onReadyRef.current?.(e) },
        onStateChange: e => onStateChangeRef.current?.(e),
        onError: e => console.warn('YT error:', e.data),
      },
    })
  }, [containerId])

  useEffect(() => {
    loadYTScript()
    if (ytApiReady) initPlayer()
    else waitingCallbacks.push(initPlayer)
    return () => {
      waitingCallbacks = waitingCallbacks.filter(cb => cb !== initPlayer)
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch (_) {}
        playerRef.current = null
      }
      setPlayerReady(false)
    }
  }, [initPlayer])

  // loadVideo: loads and buffers immediately (triggers BUFFERING → PAUSED/PLAYING)
  const loadVideo   = useCallback((videoId, startSeconds = 0) => {
    playerRef.current?.loadVideoById({ videoId, startSeconds })
  }, [])

  const cueVideo    = useCallback((videoId, startSeconds = 0) => {
    playerRef.current?.cueVideoById({ videoId, startSeconds })
  }, [])

  const play        = useCallback(() => playerRef.current?.playVideo(),               [])
  const pause       = useCallback(() => playerRef.current?.pauseVideo(),              [])
  const seekTo      = useCallback(t  => playerRef.current?.seekTo(t, true),          [])
  const getTime     = useCallback(() => playerRef.current?.getCurrentTime?.() ?? 0,  [])
  const getState    = useCallback(() => playerRef.current?.getPlayerState?.() ?? -1, [])
  const getDuration = useCallback(() => playerRef.current?.getDuration?.() ?? 0,     [])

  return { playerRef, playerReady, loadVideo, cueVideo, play, pause, seekTo, getTime, getState, getDuration }
}
