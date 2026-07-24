// ─────────────────────────────────────────────
//  middleware.ts
//  Protège toutes les routes /dashboard
//  Redirige les chauffeurs vers leur vue mobile
// ─────────────────────────────────────────────
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Récupère la session
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Séparation par sous-domaine ───────────
  // partenaire.<domaine> (ou agence.<domaine>) = PORTAIL AGENCE uniquement.
  // chauffeur.<domaine>                        = PWA CHAUFFEUR uniquement.
  // Chaque portail a sa propre page de connexion (/agence/login, /chauffeur/login).
  // Les autres hôtes (app.<domaine>, *.vercel.app, localhost) gardent le comportement normal.
  const host = (request.headers.get('host') ?? '').toLowerCase()
  const isAgencyHost    = host.startsWith('partenaire.') || host.startsWith('agence.')
  const isChauffeurHost = host.startsWith('chauffeur.')

  if (isAgencyHost) {
    // Tout ce qui n'est pas le portail agence y est renvoyé.
    if (
      pathname === '/' ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/chauffeur')
    ) {
      return NextResponse.redirect(new URL('/agence', request.url))
    }
    // /agence/*, /api/*, assets → laissés passer (le portail agence a ses propres gardes)
  }

  if (isChauffeurHost) {
    // Tout ce qui n'est pas la PWA chauffeur y est renvoyé.
    if (
      pathname === '/' ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/agence')
    ) {
      return NextResponse.redirect(new URL('/chauffeur', request.url))
    }
    // /chauffeur/*, /api/*, assets → laissés passer (la PWA a ses propres gardes)
  }

  // ── Routes publiques ──────────────────────
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/reset-password']
  if (publicRoutes.includes(pathname)) {
    // Si déjà connecté → dashboard
    if (user) {
      return NextResponse.redirect(new URL('/dashboard/dossiers', request.url))
    }
    return supabaseResponse
  }

  // ── API : autorisation par rôle (défense de périmètre) ──
  // Les routes de la PWA chauffeur (/api/chauffeur/*) ont leurs propres gardes.
  // Toutes les autres API sont du back-office → admin/dispatcher requis.
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/chauffeur/')) return supabaseResponse
    if (pathname.startsWith('/api/agence/')) return supabaseResponse
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!prof || (prof.role !== 'admin' && prof.role !== 'dispatcher')) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
    }
    return supabaseResponse
  }

  // ── Routes protégées ─────────────────────
  if (pathname.startsWith('/dashboard') || pathname === '/') {
    if (!user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Récupère le profil pour le rôle
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Chauffeur / sous-traitant → redirigé vers la PWA mobile dédiée
    if (profile?.role === 'chauffeur' || profile?.role === 'sous_traitant') {
      return NextResponse.redirect(new URL('/chauffeur', request.url))
    }

    // Agence → portail dédié
    if (profile?.role === 'agence') {
      return NextResponse.redirect(new URL('/agence', request.url))
    }

    // Redirect racine → dossiers
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard/dossiers', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
