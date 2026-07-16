import { useState } from 'react'

// Recherche plein-texte + pagination côté client, réutilisable sur toutes les listes.
export function useSearchPaginate<T>(items: T[], getText: (x: T) => string, pageSize = 15) {
  const [query, setQueryRaw] = useState('')
  const [page, setPage] = useState(1)

  const q = query.trim().toLowerCase()
  const filtered = q ? items.filter(x => getText(x).toLowerCase().includes(q)) : items
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const cur = Math.min(page, pageCount)
  const pageItems = filtered.slice((cur - 1) * pageSize, cur * pageSize)

  const setQuery = (v: string) => { setQueryRaw(v); setPage(1) }
  return { query, setQuery, page: cur, setPage, pageItems, total: filtered.length, pageCount, filtered }
}
