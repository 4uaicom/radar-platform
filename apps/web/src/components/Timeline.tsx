import { useMemo, useRef } from 'react'
import type { Grant, Source, UserState } from '../types'
import { computeStatus, daysLeft, effective, formatDate, parseDate, startOfDay, DAY } from '../lib/grants'
import { ForWhomPill, MyStatusBadge, OwnSourcePill, STATUS_STYLE, StatusBadge } from './StatusBadge'

export type Zoom = 'miesiac' | 'kwartal' | 'polrocze'

const ZOOM_RANGE: Record<Zoom, { before: number; after: number }> = {
  miesiac: { before: 14, after: 45 },
  kwartal: { before: 30, after: 90 },
  polrocze: { before: 45, after: 150 },
}

interface Props {
  grants: Grant[]
  sources: Source[]
  state: Record<string, UserState>
  today: Date
  zoom: Zoom
  onOpen: (id: string) => void
}

export function Timeline({ grants, sources, state, today, zoom, onOpen }: Props) {
  const t0 = startOfDay(today)
  const range = ZOOM_RANGE[zoom]
  const start = new Date(t0.getTime() - range.before * DAY)
  const end = new Date(t0.getTime() + range.after * DAY)
  const span = end.getTime() - start.getTime()
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])

  const pos = (iso: string) => {
    const p = ((parseDate(iso).getTime() - start.getTime()) / span) * 100
    return Math.max(0, Math.min(100, p))
  }
  const inRange = (iso?: string) => !!iso && parseDate(iso) >= start && parseDate(iso) <= end

  const months = useMemo(() => {
    const out: { label: string; left: number }[] = []
    const m = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    while (m <= end) {
      out.push({
        label: m.toLocaleDateString('pl-PL', { month: 'short', year: zoom === 'polrocze' ? '2-digit' : undefined }),
        left: ((m.getTime() - start.getTime()) / span) * 100,
      })
      m.setMonth(m.getMonth() + 1)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start.getTime(), end.getTime()])

  const todayLeft = ((t0.getTime() - start.getTime()) / span) * 100

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = e.key === 'ArrowDown' ? index + 1 : index - 1
      rowRefs.current[Math.max(0, Math.min(grants.length - 1, next))]?.focus()
    }
  }

  if (grants.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600">Brak naborów z datami dla wybranych filtrów.</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" role="region" aria-label="Oś czasu naborów">
      {/* Nagłówek z miesiącami */}
      <div className="grid grid-cols-[minmax(220px,300px)_1fr] border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
        <div className="px-4 py-2 font-medium">Nabór</div>
        <div className="relative h-8" aria-hidden="true">
          {months.map((m) => (
            <span key={m.left} className="absolute top-2 -translate-x-1/2" style={{ left: `${m.left}%` }}>
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="relative" aria-label="Nabory – użyj strzałek góra/dół, Enter otwiera szczegóły">
        {grants.map((grant, i) => {
          const g = effective(grant)
          const status = computeStatus(grant, today)
          const src = sources.find((s) => s.id === grant.source_id)
          const left = daysLeft(grant, today)
          const isNew = !state[grant.id]?.seen
          const my = state[grant.id]?.my_status
          const barStart = g.opens_at ? pos(g.opens_at) : null
          const barEnd = g.closes_at ? pos(g.closes_at) : null
          const label = [
            g.title,
            src?.name,
            src?.origin === 'wlasna' && 'twoja strona',
            `status: ${status === 'konczy_sie' ? 'kończy się' : status}`,
            `publikacja ${formatDate(g.announced_at)}`,
            g.opens_at && `otwarcie ${formatDate(g.opens_at)}`,
            g.closes_at && `zamknięcie ${formatDate(g.closes_at)}`,
            left !== null && left >= 0 && `zostało ${left} dni`,
            isNew && 'nowy',
            my && my !== 'Nowy' && `mój status: ${my}`,
            state[grant.id]?.for_whom?.length && `dla: ${state[grant.id]!.for_whom!.join(', ')}`,
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <li key={grant.id} className="border-b border-slate-100 last:border-b-0">
              <button
                ref={(el) => {
                  rowRefs.current[i] = el
                }}
                type="button"
                onClick={() => onOpen(grant.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                aria-label={label}
                className="grid w-full grid-cols-[minmax(220px,300px)_1fr] text-left hover:bg-slate-50 focus-visible:bg-indigo-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600"
              >
                <div className="min-w-0 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-hidden="true" />}
                    <span className="truncate text-sm font-medium text-slate-900">{g.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                    <StatusBadge status={status} />
                    {my && my !== 'Nowy' && <MyStatusBadge status={my} />}
                    {(state[grant.id]?.for_whom ?? []).map((f) => (
                      <ForWhomPill key={f} name={f} />
                    ))}
                    <span className="truncate">{src?.name}</span>
                    {src?.origin === 'wlasna' && <OwnSourcePill />}
                    {grant.updated && <span className="shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">Zaktualizowany</span>}
                  </div>
                </div>

                <div className="relative h-full min-h-14" aria-hidden="true">
                  {months.map((m) => (
                    <span key={m.left} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: `${m.left}%` }} />
                  ))}
                  <span className="absolute inset-y-0 w-0.5 bg-rose-500" style={{ left: `${todayLeft}%` }} />

                  {/* ② okres naboru */}
                  {barStart !== null && barEnd !== null && barEnd > 0 && barStart < 100 && (
                    <span
                      className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${STATUS_STYLE[status].bar}`}
                      style={{ left: `${barStart}%`, width: `${Math.max(0.8, barEnd - barStart)}%` }}
                    />
                  )}
                  {/* ① publikacja informacji */}
                  {inRange(g.announced_at) && (
                    <span
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-700 bg-white"
                      style={{ left: `${pos(g.announced_at)}%` }}
                    />
                  )}
                  {/* ③ zamknięcie */}
                  {inRange(g.closes_at) && (
                    <span
                      className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white bg-slate-900"
                      style={{ left: `${pos(g.closes_at!)}%` }}
                    />
                  )}
                  {left !== null && left >= 0 && inRange(g.closes_at) && (
                    <span
                      className="absolute top-1 whitespace-nowrap text-[11px] font-medium text-slate-700"
                      style={{ left: `calc(${pos(g.closes_at!)}% + 10px)` }}
                    >
                      {left === 0 ? 'dziś' : `${left} dni`}
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-700" aria-label="Legenda">
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border-2 border-slate-700 bg-white" aria-hidden="true" /> ① Publikacja informacji
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-8 rounded-full bg-emerald-600" aria-hidden="true" /> ② Nabór trwa (od–do)
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 rotate-45 bg-slate-900" aria-hidden="true" /> ③ Zamknięcie
      </li>
      <li className="flex items-center gap-2">
        <span className="h-4 w-0.5 bg-rose-500" aria-hidden="true" /> Dziś
      </li>
      <li className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-indigo-600" aria-hidden="true" /> Nowy
      </li>
    </ul>
  )
}
