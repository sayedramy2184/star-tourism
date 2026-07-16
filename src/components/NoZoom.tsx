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

    // Pincement générique à 2 doigts (ne touche pas aux taps à 1 doigt).
    // NB : pas de preventDefault sur touchend — ça annulerait les clics/mousedown.
    // Le double-tap-zoom est déjà neutralisé par `touch-action` en CSS.
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', prevent)
      document.removeEventListener('gesturechange', prevent)
      document.removeEventListener('gestureend', prevent)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return null
}
