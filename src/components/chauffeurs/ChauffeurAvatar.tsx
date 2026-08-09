// Avatar chauffeur : photo si disponible, sinon initiales.
// Composant présentationnel (sans hooks) — utilisable côté serveur et client.
export default function ChauffeurAvatar({
  photoUrl, initials, size, bg, color, borderWidth = 2, fontSize,
}: {
  photoUrl?: string | null
  initials: string
  size: number
  bg: string
  color: string
  borderWidth?: number
  fontSize: number
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: bg, border: `${borderWidth}px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      fontSize, fontWeight: 700, color, fontFamily: 'Cormorant Garamond,serif',
    }}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials
      )}
    </div>
  )
}
