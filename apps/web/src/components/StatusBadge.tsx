import type { GrantStatus, MyStatus } from '../types'
import { STATUS_LABEL } from '../lib/grants'

export const STATUS_STYLE: Record<GrantStatus, { bar: string; badge: string }> = {
  zapowiedz: { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-800 ring-slate-300' },
  zapowiedziany: { bar: 'bg-sky-600', badge: 'bg-sky-50 text-sky-900 ring-sky-300' },
  otwarty: { bar: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-900 ring-emerald-300' },
  konczy_sie: { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-900 ring-amber-400' },
  zamkniety: { bar: 'bg-slate-300', badge: 'bg-slate-100 text-slate-600 ring-slate-300' },
}

export function StatusBadge({ status }: { status: GrantStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status].badge}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

const MY_STATUS_STYLE: Record<MyStatus, string> = {
  Nowy: 'bg-indigo-50 text-indigo-900 ring-indigo-300',
  Analizuję: 'bg-violet-50 text-violet-900 ring-violet-300',
  Obserwuję: 'bg-sky-50 text-sky-900 ring-sky-300',
  'Przygotowuję wniosek': 'bg-amber-50 text-amber-900 ring-amber-300',
  Złożony: 'bg-teal-50 text-teal-900 ring-teal-300',
  'W ocenie': 'bg-cyan-50 text-cyan-900 ring-cyan-300',
  Przyznany: 'bg-emerald-600 text-white ring-emerald-700',
  Odrzucony: 'bg-rose-50 text-rose-900 ring-rose-300',
  'Nie dla mnie': 'bg-slate-100 text-slate-600 ring-slate-300',
}

export function MyStatusBadge({ status }: { status: MyStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${MY_STATUS_STYLE[status]}`}>
      {status}
    </span>
  )
}

export function ForWhomPill({ name }: { name: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-800 ring-1 ring-inset ring-slate-400">
      <span className="text-slate-500">dla:</span> {name}
    </span>
  )
}

export function OwnSourcePill() {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-fuchsia-50 px-1.5 py-0.5 text-[11px] font-semibold text-fuchsia-900 ring-1 ring-inset ring-fuchsia-300">
      Twoja strona
    </span>
  )
}

export function CatalogPill() {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
      Katalog Radaru
    </span>
  )
}
