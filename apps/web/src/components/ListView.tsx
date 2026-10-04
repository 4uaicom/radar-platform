import type { Grant, Source, UserState } from '../types'
import { computeStatus, daysLeft, effective, formatDate, formatPLN } from '../lib/grants'
import { ForWhomPill, MyStatusBadge, OwnSourcePill, StatusBadge } from './StatusBadge'

interface Props {
  grants: Grant[]
  sources: Source[]
  state: Record<string, UserState>
  today: Date
  onOpen: (id: string) => void
}

export function ListView({ grants, sources, state, today, onOpen }: Props) {
  if (grants.length === 0) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600">Brak naborów dla wybranych filtrów.</p>
  }
  return (
    <ul className="space-y-2" aria-label="Lista naborów posortowana po terminie zamknięcia">
      {grants.map((grant) => {
        const g = effective(grant)
        const status = computeStatus(grant, today)
        const left = daysLeft(grant, today)
        const src = sources.find((s) => s.id === grant.source_id)
        const isNew = !state[grant.id]?.seen
        return (
          <li key={grant.id}>
            <button
              type="button"
              onClick={() => onOpen(grant.id)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <StatusBadge status={status} />
                {isNew && <span className="rounded-full bg-indigo-600 px-2 py-0.5 font-medium text-white">Nowy</span>}
                {state[grant.id]?.my_status && state[grant.id].my_status !== 'Nowy' && (
                  <MyStatusBadge status={state[grant.id].my_status} />
                )}
                {(state[grant.id]?.for_whom ?? []).map((f) => (
                  <ForWhomPill key={f} name={f} />
                ))}
                <span>{src?.name}</span>
                {src?.origin === 'wlasna' && <OwnSourcePill />}
              </div>
              <p className="mt-2 font-medium text-slate-900">{g.title}</p>
              {g.program && <p className="text-xs text-slate-600">{g.program.name}</p>}
              <p className="mt-1 text-sm text-slate-700">
                {g.opens_at || g.closes_at ? `${formatDate(g.opens_at)} – ${formatDate(g.closes_at)}` : 'Terminy nieznane'}
                {left !== null && left >= 0 && <strong className={left < 7 ? ' text-amber-800' : ''}> · zostało {left} dni</strong>}
                {g.max_grant !== undefined && <> · do {formatPLN(g.max_grant)}</>}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
