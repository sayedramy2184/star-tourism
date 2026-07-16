'use client'

import { useEffect } from 'react'

// Bloque le zoom sur mobile — en particulier iOS Safari qui ignore
// `user-scalable=no`. On intercepte les gestes de pincement et le double-tap.
export default function NoZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()

    // Pincement (Safari iOS : événements "gesture*")
    document.addEventListener('gesturestart', prevent, { passive: false })
    document.addEventListener('gesturechange', prevent, { passive: false })
    document.addEventListener('gestureend', prevent, { passive: false })

    // Pincement générique (2 doigts) + double-tap
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    let lastTouchEnd = 0
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault()
      lastTouchEnd = now
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', prevent)
      document.removeEventListener('gesturechange', prevent)
      document.removeEventListener('gestureend', prevent)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  return null
}
