import { Plane, TramFront } from 'lucide-react'

interface Props {
  numero?: string | null
  heure?: string | null
  ville?: string | null
  terminal?: string | null
  arrivee?: boolean | null
  train?: boolean
  compact?: boolean
}

// Bloc d'info vol/train type WAY-Plan : « CDG 1 Ey031 à 07:55 de Abu Dhabi »
export default function FlightBlock({ numero, heure, ville, terminal, arrivee, train, compact }: Props) {
  if (!numero && !ville && !terminal && !heure) return null
  const Icon = train ? TramFront : Plane
  const sens = arrivee === false ? 'pour' : 'de'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: '#1e3f70', color: '#fff',
      padding: compact ? '2px 7px' : '4px 9px',
      fontSize: compact ? '10px' : '11px', fontWeight: 500,
      marginTop: '4px', maxWidth: '100%',
    }}>
      <Icon size={compact ? 11 : 13} style={{ flexShrink: 0, opacity: 0.85 }} />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {terminal ? <b style={{ fontWeight: 700 }}>{terminal} </b> : null}
        {numero ? <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{numero}</span> : null}
        {heure ? ` à ${heure.slice(0, 5)}` : ''}
        {ville ? ` ${sens} ${ville}` : ''}
      </span>
    </div>
  )
}
