import type { Grant } from '../types'
import { parseAmountPLN } from './rules'
import { datePair, isoDay, makeGrant, slug, stillOpen, text } from './common'

export const PARP_URL = 'https://www.parp.gov.pl/harmonogram-naborow'

const PROGRAMS: Record<string, string> = {
  feng: 'Fundusze Europejskie dla Nowoczesnej Gospodarki (FENG)',
  fers: 'Fundusze Europejskie dla Rozwoju Społecznego (FERS)',
  fepw: 'Fundusze Europejskie dla Polski Wschodniej (FEPW)',
}

interface Round {
  href: string
  program?: string
  title: string
  desc: string
  max?: number
  rawOpens?: string
  rawCloses?: string
  finalEnd?: string
}

/**
 * Harmonogram PARP: kafelki <a class="schedule-main schedule-feng"> pogrupowane po miesiącach.
 * Ten sam nabór może się powtarzać (kolejne rundy) – zostawiamy bieżącą albo najbliższą rundę.
 */
export function parseParp(html: string, today: Date, source_id = 'c06'): Grant[] {
  const parts = html.split(/<a href="([^"]+)" class="schedule-main schedule-(\w+)"\s*>/)
  const rounds: Round[] = []
  for (let i = 1; i + 2 < parts.length; i += 3) {
    const href = parts[i]?.trim()
    const cls = parts[i + 1]
    const body = parts[i + 2] ?? ''
    const title = text(body.match(/<p class="text-mm-18[^"]*">([\s\S]*?)<\/p>/)?.[1])
    if (!href || !title) continue
    const descRaw = body.match(/<p class="text-cr-14 text-dark mb-3">([\s\S]*?)<\/p>/)?.[1] ?? ''
    const desc = /Przejdź na stronę/i.test(descRaw) ? '' : text(descRaw)
    const maxRaw = body.match(/Maksymalne dofinansowanie:(?:\s*<\/span>)?\s*([^<]+)/i)?.[1]
    const dates = [...body.matchAll(/<p class="m-0 text-cr-18[^"]*">\s*([^<]+?)\s*<\/p>\s*<p class="mb-3 text-cr-13[^"]*">\s*([^<]+?)\s*<\/p>/g)]
    const rawOpens = dates.find((d) => /rozpocz/i.test(d[2]))?.[1]
    const rawCloses = dates.find((d) => /zako/i.test(d[2]))?.[1]
    const finalEnd = body.match(/Koniec naboru:\s*([\d.]+)/)?.[1]
    rounds.push({ href, program: PROGRAMS[cls], title, desc, max: parseAmountPLN(maxRaw).value ?? undefined, rawOpens, rawCloses, finalEnd })
  }

  // jedna pozycja na nabór: bieżąca/najbliższa runda
  const day = isoDay(today)
  const byKey = new Map<string, { r: Round; grant: Grant }>()
  for (const r of rounds) {
    const dates = datePair(r.rawOpens, r.rawCloses)
    const key = `${r.href}|${r.title}`
    const idBase = slug(r.href.replace(/\/+$/, '').split('/').pop() || r.title) || slug(r.title)
    const notes: string[] = []
    if (r.finalEnd) notes.push(`Nabór ma kilka rund – koniec całego naboru: ${r.finalEnd}`)
    if (!r.rawOpens && !r.rawCloses) notes.push('Harmonogram nie podaje dat (nabór ciągły albo terminy do ustalenia)')
    const grant = makeGrant(
      {
        id: `parp-${idBase}`,
        source_id,
        sourceName: 'PARP – harmonogram naborów',
        title: r.title,
        institution: r.href.includes('parp.gov.pl') ? 'PARP' : 'PARP (operator programu)',
        source_url: r.href,
        dates,
        max_grant: r.max,
        program: r.program ? { name: r.program, url: PARP_URL } : undefined,
        scope: r.desc,
        notes,
      },
      today,
    )
    const prev = byKey.get(key)
    const isCurrent = (g: Grant) => !g.closes_at || g.closes_at >= day
    if (
      !prev ||
      (isCurrent(grant) && !isCurrent(prev.grant)) ||
      (isCurrent(grant) && isCurrent(prev.grant) && (grant.opens_at ?? '') < (prev.grant.opens_at ?? ''))
    )
      byKey.set(key, { r, grant })
  }
  // unikalne id (różne nabory mogą mieć ten sam adres)
  const seen = new Map<string, number>()
  return [...byKey.values()]
    .map((x) => x.grant)
    .filter((g) => stillOpen(g, today))
    .map((g) => {
      const n = seen.get(g.id) ?? 0
      seen.set(g.id, n + 1)
      return n ? { ...g, id: `${g.id}-${slug(g.title)}` } : g
    })
}
