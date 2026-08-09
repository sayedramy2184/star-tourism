// URL publique d'une photo de chauffeur (bucket public 'chauffeur-photos').
export function photoChauffeurUrl(path?: string | null): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/chauffeur-photos/${path}`
}
