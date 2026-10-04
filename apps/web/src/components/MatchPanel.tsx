import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Grant, Source } from '../types'
import { rankGrants, fmt } from '../match/rules'
import { isActive, isArchived, markSeen, newMatches } from '../match/alerts'
import {
  CATEGORIES,
  LEGAL_FORMS,
  SIZES,
  STAGES,
  VERDICT_LABEL,
  VOIVODESHIPS,
  type AiMatch,
  type Category,
  type CheckStatus,
  type ClientProfile,
  type MatchResult,
  type Verdict,
} from '../match/types'
import { computeStatus, formatDate } from '../lib/grants'

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm aria-[invalid=true]:border-rose-600'
const primary =
  'rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
const secondary =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

const VERDICT_STYLE: Record<Verdict, string> = {
  pasuje: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  moze_pasowac: 'bg-amber-50 text-amber-900 ring-amber-300',
  nie_pasuje: 'bg-slate-100 text-slate-700 ring-slate-300',
}

const CHECK_ICON: Record<CheckStatus, { icon: string; cls: string; sr: string }> = {
  ok: { icon: '✓', cls: 'text-emerald-700', sr: 'spełnione' },
  nie: { icon: '✗', cls: 'text-rose-700', sr: 'niespełnione' },
  sprawdz: { icon: '?', cls: 'text-amber-700', sr: 'do sprawdzenia' },
}

const AI_STATUS: Record<AiMatch['conditions'][number]['status'], CheckStatus> = { spelniony: 'ok', niespelniony: 'nie', nie_wiadomo: 'sprawdz' }

export function emptyProfile(): ClientProfile {
  return {
    // uuid jak w bazie (client_profiles.id); zapasowo – losowy identyfikator
    id: globalThis.crypto?.randomUUID?.() ?? `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    legal_form: 'jdg',
    size: 'mikro',
    voivodeship: '',
    stage: 'istniejaca',
    categories: [],
    description: '',
    updated_at: new Date().toISOString(),
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ProfileErrors = Partial<Record<'name' | 'email' | 'voivodeship' | 'categories', string>>

export function validateProfile(p: ClientProfile, others: ClientProfile[] = []): ProfileErrors {
  const e: ProfileErrors = {}
  const norm = (x: string) => x.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!p.name.trim()) e.name = 'Podaj nazwę klienta, np. „Agroturystyka Pod Lasem”.'
  else if (others.some((o) => o.id !== p.id && norm(o.name) === norm(p.name))) e.name = 'Klient o tej nazwie już jest na liście – dodaj np. miejscowość, żeby ich odróżnić.'
  if (p.email?.trim() && !EMAIL_RE.test(p.email.trim())) e.email = 'Sprawdź adres e-mail, np. jan@firma.pl.'
  if (!p.voivodeship) e.voivodeship = 'Wybierz województwo – od niego zależą nabory regionalne i LGD.'
  if (!p.categories.length && p.description.trim().length < 20) e.categories = 'Zaznacz co najmniej jeden rodzaj inwestycji albo opisz ją (min. 20 znaków).'
  return e
}

const label = <T extends string>(list: [T, string][], v: T) => list.find(([k]) => k === v)?.[1] ?? v

/** Treść e-maila do klienta z proponowanymi naborami (do skopiowania albo w programie pocztowym – nic nie wysyłamy sami). */
export function proposalEmail(p: ClientProfile, proposed: MatchResult[], grants: Grant[], fresh = false): { to: string; subject: string; body: string } {
  const byId = new Map(grants.map((g) => [g.id, g]))
  const lines = proposed.slice(0, 5).map((r, i) => {
    const g = byId.get(r.grant_id)!
    const parts = [`${i + 1}. ${g.title}`, `   Termin: ${g.closes_at ? `do ${formatDate(g.closes_at)}` : 'do potwierdzenia'}`]
    if (r.estimated_grant !== undefined) parts.push(`   Szacowana dotacja: ok. ${fmt(r.estimated_grant)} zł`)
    parts.push(`   Ogłoszenie: ${g.source_url}`)
    return parts.join('\n')
  })
  const body = [
    'Dzień dobry,',
    '',
    lines.length
      ? `na podstawie ankiety przygotowałam nabory, które mogą pasować do Państwa planów (${p.description || p.categories.map((c) => label(CATEGORIES, c)).join(', ')}):`
      : 'na podstawie ankiety nie znalazłam teraz otwartych naborów pasujących do Państwa planów. Dam znać, gdy pojawi się nowy.',
    '',
    ...lines,
    '',
    'Warunki każdego naboru potwierdzimy w ogłoszeniu przed złożeniem wniosku. Chętnie omówię szczegóły.',
    '',
    'Pozdrawiam',
  ].join('\n')
  const subject = fresh ? `Nowe nabory dla: ${p.name}` : `Proponowane dotacje dla: ${p.name}`
  return { to: p.email ?? '', subject, body }
}

export const mailtoHref = (m: { to: string; subject: string; body: string }) =>
  `mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`

/** Nowa wiadomość w poczcie przez przeglądarkę (gdy w Windows nie ma ustawionego programu pocztowego). */
export const gmailHref = (m: { to: string; subject: string; body: string }) =>
  `https://mail.google.com/mail/?${new URLSearchParams({ view: 'cm', fs: '1', to: m.to, su: m.subject, body: m.body })}`
export const outlookHref = (m: { to: string; subject: string; body: string }) =>
  `https://outlook.live.com/mail/0/deeplink/compose?${new URLSearchParams({ to: m.to, subject: m.subject, body: m.body })}`

export const proposalMailto = (p: ClientProfile, proposed: MatchResult[], grants: Grant[]) => mailtoHref(proposalEmail(p, proposed, grants))

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    // starsze przeglądarki / brak uprawnień: zaznacz i skopiuj
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand?.('copy') ?? false
    ta.remove()
    return ok
  }
}

export type MailProvider = 'gmail' | 'outlook' | 'onet' | 'wp' | 'interia' | 'inna'

/**
 * Rodzaj poczty po adresie NADAWCY (zalogowanej osoby) – to ona otwiera wiadomość, nie klient.
 * Firmowe domeny (np. @4uai.com.pl na Google Workspace) są nie do rozpoznania → „inna”.
 */
export function mailProvider(email: string | undefined): MailProvider {
  const d = (email ?? '').split('@')[1]?.toLowerCase().trim() ?? ''
  if (/^(gmail|googlemail)\.com$/.test(d)) return 'gmail'
  if (/^(outlook|hotmail|live|msn)\.[a-z.]+$/.test(d)) return 'outlook'
  if (/^(onet\.pl|op\.pl|onet\.eu|poczta\.onet\.pl|vp\.pl|spoko\.pl|autograf\.pl|buziaczek\.pl)$/.test(d)) return 'onet'
  if (/^(wp\.pl|o2\.pl|tlen\.pl)$/.test(d)) return 'wp'
  if (/^(interia\.(pl|eu|com)|poczta\.fm)$/.test(d)) return 'interia'
  return 'inna'
}

const PROVIDER_NAME: Record<MailProvider, string> = { gmail: 'Gmail', outlook: 'Outlook.com', onet: 'Onet Poczta', wp: 'WP Poczta', interia: 'Interia Poczta', inna: '' }

/** E-mail do klienta: poczta wybierana automatycznie po adresie zalogowanej osoby – bez dodatkowych opcji. */
function EmailComposer({
  initial,
  label: title,
  senderEmail,
  onClose,
}: {
  initial: { to: string; subject: string; body: string }
  label: string
  senderEmail?: string
  onClose: () => void
}) {
  const uid = useId()
  const [subject, setSubject] = useState(initial.subject)
  const [body, setBody] = useState(initial.body)
  const [copied, setCopied] = useState('')
  const provider = mailProvider(senderEmail)
  const msg = { to: initial.to, subject, body }
  const copy = async (what: string, value: string) => setCopied((await copyText(value)) ? `Skopiowano: ${what}.` : 'Nie udało się skopiować – zaznacz tekst i naciśnij Ctrl+C.')
  const canOpen = provider === 'gmail' || provider === 'outlook'
  return (
    <div role="group" aria-labelledby={`${uid}-h`} className="mt-4 w-full rounded-lg border border-slate-300 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 id={`${uid}-h`} className="text-sm font-semibold">
          {title}
        </h4>
        <button type="button" className="text-sm font-medium underline underline-offset-2" onClick={onClose}>
          Zamknij
        </button>
      </div>
      <div className="mt-3 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-600">Do:</span>
          {initial.to ? <strong className="break-all">{initial.to}</strong> : <span className="text-slate-600">brak adresu – dodaj go w ankiecie albo wpisz w poczcie</span>}
          {initial.to && (
            <button type="button" className="text-sm font-medium text-indigo-700 underline underline-offset-2" onClick={() => copy('adres', initial.to)}>
              Kopiuj adres
            </button>
          )}
        </div>
        <label className="block font-medium text-slate-800">
          Temat
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="block font-medium text-slate-800">
          Treść
          <textarea className={`${input} font-normal`} rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {canOpen && (
            <a href={provider === 'gmail' ? gmailHref(msg) : outlookHref(msg)} target="_blank" rel="noreferrer" className={primary}>
              Otwórz w {PROVIDER_NAME[provider]}
            </a>
          )}
          <button type="button" className={canOpen ? secondary : primary} onClick={() => copy('treść', body)}>
            Kopiuj treść
          </button>
        </div>
        {!canOpen && (
          <p className="text-xs text-slate-600">
            {provider === 'inna'
              ? `Nie rozpoznaliśmy poczty dla ${senderEmail ?? 'Twojego konta'} – kliknij „Kopiuj treść”, w swojej poczcie wybierz „Napisz” i wklej (Ctrl+V).`
              : `${PROVIDER_NAME[provider]} nie pozwala otworzyć gotowej wiadomości z innej strony. Kliknij „Kopiuj treść”, w poczcie wybierz „Napisz” i wklej (Ctrl+V).`}
          </p>
        )}
        <p role="status" aria-live="polite" className="text-sm font-medium text-emerald-800">
          {copied}
        </p>
      </div>
    </div>
  )
}

interface Props {
  profiles: ClientProfile[]
  grants: Grant[]
  sources: Source[]
  today: Date
  aiChecks: Record<string, AiMatch>
  onSave: (p: ClientProfile) => void
  onDelete: (id: string) => void
  onOpenGrant: (id: string) => void
  onAi: (p: ClientProfile, g: Grant) => Promise<string | null>
  /** E-mail zalogowanej osoby – po nim rozpoznajemy jej pocztę (Gmail, Outlook…) */
  userEmail?: string
}

export function MatchPanel({ profiles, grants, sources, today, aiChecks, onSave, onDelete, onOpenGrant, onAi, userEmail }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null)
  /** Nowe dopasowania klienta z chwili otwarcia panelu (po otwarciu klient jest „przejrzany”) */
  const [detailNew, setDetailNew] = useState<string[]>([])
  const [editing, setEditing] = useState<ClientProfile | null>(null)
  const [announce, setAnnounce] = useState('')
  const detail = profiles.find((p) => p.id === detailId) ?? null
  const ranked = useMemo(() => new Map(profiles.map((p) => [p.id, rankGrants(p, grants, sources, today)])), [profiles, grants, sources, today])
  const byId = useMemo(() => new Map(grants.map((g) => [g.id, g])), [grants])
  const edit = (p: ClientProfile) => {
    setDetailId(null)
    setEditing(p)
  }
  const show = (id: string) => {
    const p = profiles.find((x) => x.id === id)
    if (!p) return
    const r = ranked.get(id) ?? []
    setDetailNew(newMatches(p, r))
    if (newMatches(p, r).length) onSave(markSeen(p, r))
    setDetailId(id)
  }
  const remove = (p: ClientProfile) => {
    onDelete(p.id)
    setDetailId(null)
    setEditing(null)
    setAnnounce(`Usunięto klienta „${p.name}”.`)
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="clients-h" className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="clients-h" className="text-base font-semibold">
              Klienci ({profiles.filter((p) => !isArchived(p)).length})
            </h2>
            {profiles.length > 0 && <p className="text-sm text-slate-600">Kliknij „Pokaż”, żeby zobaczyć ankietę, nabory z oceną i e-mail z propozycjami.</p>}
            {grants.filter((g) => computeStatus(g, today) !== 'zamkniety').length === 0 && (
              <p role="note" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-300">
                <strong>Brak otwartych naborów do dopasowania</strong> – dlatego klienci mają „brak pasujących”. Włącz strony w „Baza stron i programy” i kliknij „Sprawdź
                teraz”.
              </p>
            )}
          </div>
          <button type="button" className={secondary} onClick={() => edit(emptyProfile())}>
            + Nowy klient
          </button>
        </div>

        <ClientsTable
          profiles={profiles}
          ranked={ranked}
          byId={byId}
          aiChecks={aiChecks}
          onShow={show}
          onNew={() => edit(emptyProfile())}
          onSetAuto={(ids, on) => {
            profiles.filter((p) => ids.includes(p.id) && isActive(p) !== on).forEach((p) => onSave({ ...markSeen(p, ranked.get(p.id) ?? []), active: on }))
            setAnnounce(on ? `Automatyczne dopasowanie włączone: ${ids.length}.` : `Automatyczne dopasowanie wyłączone: ${ids.length}.`)
          }}
          onRecheck={async (ids, onProgress) => {
            // ponowne dopasowanie z AI: 3 najlepsze nabory (wg reguł) każdego zaznaczonego klienta
            const jobs = profiles
              .filter((p) => ids.includes(p.id))
              .flatMap((p) => (ranked.get(p.id) ?? []).filter((r) => r.verdict !== 'nie_pasuje').slice(0, AI_PER_CLIENT).map((r) => ({ p, g: byId.get(r.grant_id)! })))
              .filter((j) => j.g)
            let errors = 0
            for (let i = 0; i < jobs.length; i++) {
              onProgress(i, jobs.length)
              if (await onAi(jobs[i].p, jobs[i].g)) errors++
            }
            onProgress(jobs.length, jobs.length)
            return { done: jobs.length - errors, errors }
          }}
          onArchive={(ids, on) => {
            profiles.filter((p) => ids.includes(p.id)).forEach((p) => onSave({ ...markSeen(p, ranked.get(p.id) ?? []), archived: on || undefined }))
            setAnnounce(on ? `Przeniesiono do archiwum: ${ids.length}.` : `Przywrócono z archiwum: ${ids.length}.`)
          }}
          onDeleteMany={(ids) => {
            ids.forEach((id) => onDelete(id))
            setAnnounce(`Usunięto klientów: ${ids.length}.`)
          }}
        />
      </section>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <FormDrawer editing={editing} isNew={!!editing && !profiles.some((p) => p.id === editing.id)} onClose={() => setEditing(null)}>
        {editing && (
          <ProfileForm
            key={editing.id}
            initial={editing}
            others={profiles}
            isNew={!profiles.some((p) => p.id === editing.id)}
            onCancel={() => setEditing(null)}
            onDelete={profiles.some((p) => p.id === editing.id) ? () => remove(editing) : undefined}
            onSave={(p) => {
              // zmiana ankiety to nie „nowy nabór” – bieżące dopasowania są punktem odniesienia
              onSave(markSeen(p, rankGrants(p, grants, sources, today)))
              setEditing(null)
              setDetailNew([])
              setDetailId(p.id)
            }}
          />
        )}
      </FormDrawer>

      <ClientDrawer
        profile={detail}
        proposed={detail ? (ranked.get(detail.id) ?? []).filter((r) => r.verdict !== 'nie_pasuje') : []}
        newIds={detailNew}
        grants={grants}
        userEmail={userEmail}
        onClose={() => setDetailId(null)}
        onEdit={edit}
        onOpenGrant={onOpenGrant}
        onToggleActive={(p) => {
          onSave({ ...markSeen(p, ranked.get(p.id) ?? []), active: !isActive(p) })
          setAnnounce(isActive(p) ? `Klient „${p.name}” wstrzymany – bez powiadomień.` : `Klient „${p.name}” znów aktywny.`)
        }}
        onArchiveOne={(p) => {
          onSave({ ...markSeen(p, ranked.get(p.id) ?? []), archived: isArchived(p) ? undefined : true })
          setAnnounce(isArchived(p) ? `Klient „${p.name}” przywrócony z archiwum.` : `Klient „${p.name}” przeniesiony do archiwum.`)
          if (!isArchived(p)) setDetailId(null)
        }}
        onDelete={remove}
      >
        {detail && <Results profile={detail} grants={grants} sources={sources} today={today} aiChecks={aiChecks} onOpenGrant={onOpenGrant} onAi={onAi} />}
      </ClientDrawer>
    </div>
  )
}

const LEGAL_SHORT: Record<ClientProfile['legal_form'], string> = {
  jdg: 'JDG',
  spolka: 'Spółka',
  rolnik: 'Rolnik',
  osoba_fizyczna: 'Osoba fizyczna',
  ngo: 'NGO',
  jst: 'Samorząd',
  uczelnia: 'Uczelnia',
}
const SIZE_SHORT: Record<ClientProfile['size'], string> = { mikro: 'mikro', mala: 'mała', srednia: 'średnia', duza: 'duża', nie_dotyczy: '' }
const catShort = (c: Category) => label(CATEGORIES, c).split(',')[0]

type SortKey = 'najnowsi' | 'nazwa' | 'dopasowanie' | 'nowe'
type StatusFilter = 'wszyscy' | 'aktywni' | 'wstrzymani' | 'archiwum'

/** Ile naborów na klienta sprawdza AI przy ponownym dopasowaniu zaznaczonych (koszt ok. 1–3 gr za nabór). */
const AI_PER_CLIENT = 3

function ClientsTable({
  profiles,
  ranked,
  byId,
  aiChecks,
  onShow,
  onNew,
  onSetAuto,
  onRecheck,
  onDeleteMany,
  onArchive,
}: {
  profiles: ClientProfile[]
  ranked: Map<string, MatchResult[]>
  byId: Map<string, Grant>
  aiChecks: Record<string, AiMatch>
  onShow: (id: string) => void
  onNew: () => void
  onSetAuto: (ids: string[], on: boolean) => void
  onRecheck: (ids: string[], onProgress: (done: number, total: number) => void) => Promise<{ done: number; errors: number }>
  onDeleteMany: (ids: string[]) => void
  onArchive: (ids: string[], on: boolean) => void
}) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkMsg, setBulkMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sort, setSort] = useState<SortKey>('najnowsi')
  const [status, setStatus] = useState<StatusFilter>('wszyscy')
  const stats = (p: ClientProfile) => {
    const list = (ranked.get(p.id) ?? []).filter((r) => r.verdict !== 'nie_pasuje')
    return { list, strong: list.filter((r) => r.verdict === 'pasuje').length, fresh: newMatches(p, ranked.get(p.id) ?? []).length }
  }
  const archivedCount = profiles.filter(isArchived).length
  const anyPaused = profiles.some((p) => !isActive(p))
  const needle = q.trim().toLowerCase()
  const rows = profiles
    .filter((p) =>
      status === 'archiwum' ? isArchived(p) : !isArchived(p) && (status === 'wszyscy' || (status === 'aktywni') === isActive(p)),
    )
    .filter((p) => !needle || [p.name, p.email ?? '', p.voivodeship, p.commune ?? ''].some((x) => x.toLowerCase().includes(needle)))
    .sort((a, b) => {
      if (sort === 'nowe') return stats(b).fresh - stats(a).fresh || b.updated_at.localeCompare(a.updated_at)
      if (sort === 'nazwa') return a.name.localeCompare(b.name, 'pl')
      if (sort === 'dopasowanie') {
        const sa = stats(a)
        const sb = stats(b)
        return sb.strong - sa.strong || sb.list.length - sa.list.length
      }
      return b.updated_at.localeCompare(a.updated_at)
    })

  const selected = picked.filter((id) => profiles.some((p) => p.id === id))
  const allShown = rows.length > 0 && rows.every((p) => selected.includes(p.id))
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const toggleAll = () => setPicked(allShown ? selected.filter((id) => !rows.some((p) => p.id === id)) : [...new Set([...selected, ...rows.map((p) => p.id)])])
  const aiCount = profiles
    .filter((p) => selected.includes(p.id))
    .reduce((n, p) => n + Math.min(AI_PER_CLIENT, (ranked.get(p.id) ?? []).filter((r) => r.verdict !== 'nie_pasuje').length), 0)
  const aiDone = (p: ClientProfile) => (ranked.get(p.id) ?? []).filter((r) => aiChecks[`${p.id}:${r.grant_id}`]).length
  const pick = (p: ClientProfile) => (
    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Zaznacz ${p.name}`} className="h-4 w-4 accent-indigo-700" />
  )
  const who = (p: ClientProfile) => [LEGAL_SHORT[p.legal_form], SIZE_SHORT[p.size]].filter(Boolean).join(' · ')
  const match = (p: ClientProfile) => {
    const { list, strong, fresh } = stats(p)
    if (!list.length) return <span className="whitespace-nowrap text-slate-500">brak pasujących</span>
    return (
      <span className="flex flex-wrap gap-1.5 whitespace-nowrap">
        {fresh > 0 && <span className="rounded-md bg-indigo-700 px-1.5 py-0.5 text-xs font-semibold text-white">{fresh} nowe</span>}
        {aiDone(p) > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 ring-inset">AI: {aiDone(p)}</span>}
        {strong > 0 && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-300 ring-inset">{strong} pasuje</span>}
        {list.length - strong > 0 && (
          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 ring-inset">{list.length - strong} może</span>
        )}
      </span>
    )
  }
  const best = (p: ClientProfile) => {
    const { list } = stats(p)
    const top = list[0] && byId.get(list[0].grant_id)
    if (!top) return <span className="text-slate-500">–</span>
    return (
      <span className="line-clamp-2" title={top.title}>
        {top.title}
        {list.length > 1 && <span className="text-slate-500"> +{list.length - 1}</span>}
      </span>
    )
  }
  const cats = (p: ClientProfile) => (
    <span className="block truncate" title={p.categories.map((c) => label(CATEGORIES, c)).join('; ')}>
      {p.categories.length ? p.categories.map(catShort).join(', ') : <span className="text-slate-500">opis</span>}
    </span>
  )
  const show = (p: ClientProfile) => (
    <button type="button" className={secondary} onClick={() => onShow(p.id)} aria-label={`Pokaż szczegóły: ${p.name}`}>
      Pokaż
    </button>
  )

  return (
    <div className="mt-4">
      {profiles.length > 0 && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-800 sm:max-w-xs">
            Szukaj klienta
            <input type="search" className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="nazwa, e-mail, województwo" />
          </label>
          <label className="text-sm font-medium text-slate-800">
            Sortuj
            <select className={input} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="najnowsi">ostatnio zmienieni</option>
              <option value="nazwa">nazwa A–Z</option>
              <option value="dopasowanie">najwięcej dopasowań</option>
              <option value="nowe">najpierw nowe dopasowania</option>
            </select>
          </label>
          {anyPaused && (
            <label className="text-sm font-medium text-slate-800">
              Status
              <select className={input} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                <option value="wszyscy">wszyscy (bez archiwum)</option>
                <option value="aktywni">z automatycznym dopasowaniem</option>
                <option value="wstrzymani">wstrzymani</option>
                <option value="archiwum">archiwum ({archivedCount})</option>
              </select>
            </label>
          )}
          <p className="pb-2 text-sm text-slate-600" role="status">
            {status === 'archiwum' ? `w archiwum: ${rows.length}` : rows.length === profiles.length - archivedCount ? `${rows.length} klientów` : `${rows.length} z ${profiles.length - archivedCount}`}
          </p>
        </div>
      )}

      {profiles.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
          <p className="font-medium text-slate-900">Nie masz jeszcze klientów</p>
          <p className="mt-1 text-sm text-slate-600">Dodaj klienta i wypełnij krótką ankietę – od razu zobaczysz nabory, które pasują do jego firmy i planów.</p>
          <button type="button" className={`${primary} mt-4`} onClick={onNew}>
            + Dodaj pierwszego klienta
          </button>
        </div>
      )}
      {profiles.length > 0 && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-600">
          {status === 'archiwum' ? 'Archiwum jest puste.' : needle ? 'Brak klientów pasujących do wyszukiwania.' : 'Wszyscy klienci są w archiwum – wybierz „Status: archiwum”, żeby ich zobaczyć.'}
        </p>
      )}

      {selected.length > 0 && (
        <div role="region" aria-label="Akcje dla zaznaczonych klientów" className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="mr-1">Zaznaczono: {selected.length}</strong>
            <button type="button" className={secondary} onClick={() => onSetAuto(selected, true)}>
              Włącz automatyczne dopasowanie
            </button>
            <button type="button" className={secondary} onClick={() => onSetAuto(selected, false)}>
              Wyłącz
            </button>
            <button
              type="button"
              className={primary}
              disabled={progress !== null || aiCount === 0}
              onClick={async () => {
                setBulkMsg('')
                const r = await onRecheck(selected, (done, total) => setProgress({ done, total }))
                setProgress(null)
                setBulkMsg(
                  r.errors
                    ? `AI sprawdziło ${r.done} naborów, ${r.errors} nie udało się (np. brak klucza AI na serwerze).`
                    : `Gotowe: AI sprawdziło ${r.done} naborów – wyniki w panelu każdego klienta.`,
                )
              }}
            >
              {progress ? `Sprawdzam z AI… ${progress.done}/${progress.total}` : `Dopasuj ponownie z AI (${aiCount})`}
            </button>
            {status === 'archiwum' ? (
              <button type="button" className={secondary} onClick={() => { onArchive(selected, false); setPicked([]) }}>
                Przywróć z archiwum
              </button>
            ) : (
              <button type="button" className={secondary} onClick={() => { onArchive(selected, true); setPicked([]) }}>
                Archiwizuj
              </button>
            )}
            <button type="button" className="ml-auto text-sm font-medium text-rose-700 underline underline-offset-2" onClick={() => setConfirmDelete(true)}>
              Usuń zaznaczonych
            </button>
            <button type="button" className="text-sm font-medium underline underline-offset-2" onClick={() => setPicked([])}>
              Odznacz
            </button>
          </div>
          <p className="mt-2 text-xs">
            Reguły dopasowują klientów automatycznie przy każdym sprawdzeniu stron (bezpłatnie). „Dopasuj ponownie z AI” czyta ogłoszenia {AI_PER_CLIENT} najlepszych naborów
            każdego zaznaczonego klienta – płatne, ok. 1–3 gr za nabór.
          </p>
          {confirmDelete && (
            <div role="group" aria-label="Potwierdź usunięcie zaznaczonych" className="mt-2 rounded-lg bg-rose-50 p-3 text-rose-950 ring-1 ring-rose-200">
              <p>Usunąć {selected.length} klientów? Znikną ich ankiety i opinie AI. Tego nie da się cofnąć.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  autoFocus
                  className="rounded-lg bg-rose-700 px-3 py-1.5 font-medium text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                  onClick={() => {
                    onDeleteMany(selected)
                    setPicked([])
                    setConfirmDelete(false)
                  }}
                >
                  Tak, usuń
                </button>
                <button type="button" className={secondary} onClick={() => setConfirmDelete(false)}>
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className={bulkMsg && !progress ? 'mb-3 text-sm text-slate-700' : 'sr-only'}>
        {progress ? `Sprawdzam z AI ${progress.done} z ${progress.total}` : bulkMsg}
      </p>

      {/* szeroki ekran: tabela */}
      {rows.length > 0 && (
        <div className="relative hidden overflow-x-auto rounded-lg border border-slate-200 lg:block">
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">Klienci, ich ankiety i proponowane nabory</caption>
            <colgroup>
              <col className="w-[44px]" />
              <col className="w-[20%]" />
              <col className="w-[17%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
              <col className="w-[14%]" />
              <col />
              <col className="w-[84px]" />
            </colgroup>
            <thead className="bg-slate-50">
              <tr className="text-xs uppercase tracking-wide text-slate-600">
                <th scope="col" className="py-2.5 pl-3">
                  <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Zaznacz wszystkich widocznych klientów" className="h-4 w-4 accent-indigo-700" />
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Klient</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">E-mail</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Inwestycja</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Budżet</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Dopasowanie</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Najlepszy program</th>
                <th scope="col" className="px-3 py-2.5">
                  <span className="sr-only">Akcje</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={`border-t border-slate-200 hover:bg-slate-50 ${selected.includes(p.id) ? 'bg-indigo-50/60' : ''}`}>
                  <td className="py-2.5 pl-3">{pick(p)}</td>
                  <th scope="row" className={`px-3 py-2.5 font-medium ${isActive(p) ? 'text-slate-900' : 'text-slate-500'}`}>
                    <span className="block truncate" title={p.name}>
                      {p.name}
                    </span>
                    {!isActive(p) && (
                      <span className="mr-1 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{isArchived(p) ? 'W archiwum' : 'Wstrzymany'}</span>
                    )}
                    <span className="block truncate text-xs font-normal text-slate-600">
                      {who(p)} · {p.voivodeship}
                    </span>
                  </th>
                  <td className="px-3 py-2.5">
                    {p.email ? (
                      <a href={`mailto:${p.email}`} title={p.email} className="block truncate text-indigo-700 underline underline-offset-2">
                        {p.email}
                      </a>
                    ) : (
                      <span className="text-slate-500">brak</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-800">
                    {cats(p)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">{p.budget ? `${fmt(p.budget)} zł` : '–'}</td>
                  <td className="px-3 py-2.5">
                    {match(p)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-800">
                    {best(p)}
                  </td>
                  <td className="px-3 py-2 text-right">{show(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* wąski ekran: karty */}
      {rows.length > 0 && (
        <ul className="space-y-2 lg:hidden" aria-label="Klienci">
          {rows.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="pt-1">{pick(p)}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {p.name}
                    {!isActive(p) && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{isArchived(p) ? 'W archiwum' : 'Wstrzymany'}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">
                    {who(p)} · woj. {p.voivodeship}
                  </p>
                </div>
                {show(p)}
              </div>
              {p.email && (
                <a href={`mailto:${p.email}`} className="mt-1 block truncate text-sm text-indigo-700 underline underline-offset-2">
                  {p.email}
                </a>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-800">
                {match(p)}
                <span className="min-w-0 flex-1">
                  {best(p)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Panel boczny z ankietą (nowy klient / edycja). */
function FormDrawer({ editing, isNew, onClose, children }: { editing: ClientProfile | null; isNew: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (editing && !d.open) d.showModal()
    if (!editing && d.open) d.close()
  }, [editing])
  return (
    <dialog
      ref={ref}
      aria-labelledby={editing ? 'form-drawer-h' : undefined}
      onClose={onClose}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(640px,100vw)] max-w-none border-0 bg-white p-0 text-slate-900 shadow-2xl [color-scheme:light] backdrop:bg-slate-900/40"
    >
      {editing && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{isNew ? 'Nowy klient' : 'Edycja ankiety'}</p>
              <h2 id="form-drawer-h" className="text-lg font-semibold">
                {isNew ? 'Ankieta klienta' : editing.name}
              </h2>
            </div>
            <button type="button" className={secondary} onClick={() => ref.current?.close()}>
              Zamknij
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 pt-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}

/** Panel boczny (natywny <dialog>: fokus, Escape i tło obsługuje przeglądarka). */
/** Usunięcie z potwierdzeniem na stronie (bez okna przeglądarki). */
function DeleteClient({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking)
    return (
      <button type="button" className="text-sm font-medium text-rose-700 underline underline-offset-2" onClick={() => setAsking(true)}>
        Usuń klienta
      </button>
    )
  return (
    <div role="group" aria-label={`Potwierdź usunięcie ${name}`} className="w-full rounded-lg bg-rose-50 p-3 text-sm text-rose-950 ring-1 ring-rose-200">
      <p>
        Usunąć klienta <strong>{name}</strong>? Znikną jego ankieta i opinie AI. Tego nie da się cofnąć – jeśli chcesz tylko schować klienta, przenieś go do archiwum.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          autoFocus
          className="rounded-lg bg-rose-700 px-3 py-1.5 font-medium text-white hover:bg-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
          onClick={onConfirm}
        >
          Tak, usuń
        </button>
        <button type="button" className={secondary} onClick={() => setAsking(false)}>
          Anuluj
        </button>
      </div>
    </div>
  )
}

function ClientDrawer({
  profile,
  proposed,
  newIds,
  grants,
  userEmail,
  onClose,
  onEdit,
  onOpenGrant,
  onToggleActive,
  onArchiveOne,
  onDelete,
  children,
}: {
  profile: ClientProfile | null
  proposed: MatchResult[]
  newIds: string[]
  grants: Grant[]
  userEmail?: string
  onClose: () => void
  onEdit: (p: ClientProfile) => void
  onOpenGrant: (id: string) => void
  onToggleActive: (p: ClientProfile) => void
  onArchiveOne: (p: ClientProfile) => void
  onDelete: (p: ClientProfile) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [mail, setMail] = useState<'wszystkie' | 'nowe' | null>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (profile && !d.open) d.showModal()
    if (!profile && d.open) d.close()
  }, [profile])

  const rows: [string, string][] = profile
    ? [
        ['Forma prawna', label(LEGAL_FORMS, profile.legal_form)],
        ['Wielkość', label(SIZES, profile.size)],
        ['Lokalizacja', `woj. ${profile.voivodeship}${profile.commune ? `, gmina ${profile.commune}` : ''}`],
        ['PKD', profile.pkd || '–'],
        ['Etap firmy', label(STAGES, profile.stage)],
        ['Co chce sfinansować', profile.categories.map((c) => label(CATEGORIES, c)).join('; ') || '–'],
        ['Opis inwestycji', profile.description || '–'],
        ['Budżet projektu', profile.budget ? `${fmt(profile.budget)} zł` : '–'],
        ['Wkład własny', profile.own_contribution_pct !== undefined ? `${profile.own_contribution_pct}%` : '–'],
      ]
    : []

  return (
    <dialog
      ref={ref}
      aria-labelledby={profile ? 'drawer-h' : undefined}
      onClose={() => {
        setMail(null)
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(760px,100vw)] max-w-none border-0 bg-slate-50 p-0 text-slate-900 shadow-2xl [color-scheme:light] backdrop:bg-slate-900/40"
    >
      {profile && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Klient</p>
              <h2 id="drawer-h" className="text-lg font-semibold">
                {profile.name}
              </h2>
              {profile.email && (
                <a href={`mailto:${profile.email}`} className="text-sm text-indigo-700 underline underline-offset-2">
                  {profile.email}
                </a>
              )}
            </div>
            <button type="button" className={secondary} onClick={() => ref.current?.close()}>
              Zamknij
            </button>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {newIds.length > 0 && (
              <section aria-labelledby="drawer-new-h" className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                <h3 id="drawer-new-h" className="text-base font-semibold text-indigo-950">
                  Nowe dopasowania ({newIds.length})
                </h3>
                <p className="mt-1 text-sm text-indigo-950">Agent znalazł nabory, które pasują do tego klienta, a których nie było przy Twoim ostatnim przeglądzie.</p>
                <ul className="mt-3 space-y-1.5">
                  {newIds.map((id) => {
                    const g = grants.find((x) => x.id === id)
                    return (
                      g && (
                        <li key={id}>
                          <button type="button" className="text-left text-sm font-medium text-indigo-800 underline underline-offset-2" onClick={() => onOpenGrant(id)}>
                            {g.title}
                          </button>
                          {g.closes_at && <span className="text-sm text-indigo-950"> – do {formatDate(g.closes_at)}</span>}
                        </li>
                      )
                    )
                  })}
                </ul>
                {mail === 'nowe' ? (
                  <EmailComposer
                    key="nowe"
                    label="E-mail o nowych naborach"
                    senderEmail={userEmail}
                    initial={proposalEmail(profile, proposed.filter((r) => newIds.includes(r.grant_id)), grants, true)}
                    onClose={() => setMail(null)}
                  />
                ) : (
                  <button type="button" className={`${primary} mt-4`} onClick={() => setMail('nowe')}>
                    E-mail o nowych ({Math.min(newIds.length, 5)})
                  </button>
                )}
              </section>
            )}
            <section aria-labelledby="drawer-survey-h" className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="drawer-survey-h" className="text-base font-semibold">
                  Ankieta
                </h3>
                <button type="button" className="text-sm font-medium text-indigo-700 underline" onClick={() => onEdit(profile)}>
                  Edytuj ankietę
                </button>
              </div>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-600">{k}</dt>
                    <dd className="text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                {mail === 'wszystkie' ? (
                  <EmailComposer key="wszystkie" label="E-mail z propozycjami" senderEmail={userEmail} initial={proposalEmail(profile, proposed, grants)} onClose={() => setMail(null)} />
                ) : (
                  <>
                    <button type="button" className={primary} onClick={() => setMail('wszystkie')}>
                      E-mail z propozycjami{proposed.length ? ` (${Math.min(proposed.length, 5)})` : ''}
                    </button>
                    <p className="text-xs text-slate-600">Pokaże gotową treść do skopiowania – możesz ją poprawić, wkleić do poczty albo otworzyć w programie pocztowym.</p>
                  </>
                )}
              </div>
            </section>
            {children}
            <section aria-labelledby="drawer-manage-h" className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 id="drawer-manage-h" className="text-base font-semibold">
                Zarządzaj klientem
              </h3>
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-slate-800">
                <input
                  type="checkbox"
                  role="switch"
                  checked={isActive(profile)}
                  disabled={isArchived(profile)}
                  onChange={() => onToggleActive(profile)}
                  className="mt-0.5 h-4 w-4 accent-indigo-700"
                />
                <span>
                  <span className="font-medium">Automatyczne dopasowanie</span>
                  <span className="block text-slate-600">
                    Przy każdym sprawdzeniu stron aplikacja dopasowuje temu klientowi nowe nabory i pokazuje je jako „nowe”. Wyłączony klient zostaje w bazie, ale bez
                    powiadomień.
                  </span>
                </span>
              </label>
              <div className="mt-4 flex flex-wrap items-start gap-4 border-t border-slate-200 pt-4">
                <button type="button" className={secondary} onClick={() => onArchiveOne(profile)}>
                  {isArchived(profile) ? 'Przywróć z archiwum' : 'Przenieś do archiwum'}
                </button>
                <DeleteClient name={profile.name} onConfirm={() => onDelete(profile)} />
              </div>
            </section>
          </div>
        </div>
      )}
    </dialog>
  )
}

function ProfileForm({
  initial,
  isNew,
  onSave,
  onCancel,
  onDelete,
  others = [],
}: {
  initial: ClientProfile
  isNew: boolean
  others?: ClientProfile[]
  onSave: (p: ClientProfile) => void
  onCancel?: () => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [p, setP] = useState<ClientProfile>(initial)
  const [errors, setErrors] = useState<ProfileErrors>({})
  const set = <K extends keyof ClientProfile>(k: K, v: ClientProfile[K]) => setP((x) => ({ ...x, [k]: v }))
  const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v.replace(/\s/g, '').replace(',', '.'))))
  const err = (k: keyof ProfileErrors) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} className="mt-1 text-xs text-rose-700">
        {errors[k]}
      </p>
    ) : null
  const aria = (k: keyof ProfileErrors) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `${uid}-${k}-err` : undefined })

  return (
    <form
      aria-label={isNew ? 'Ankieta nowego klienta' : `Ankieta klienta: ${initial.name}`}
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const v = validateProfile(p, others)
        setErrors(v)
        const first = (['name', 'email', 'voivodeship', 'categories'] as const).find((k) => v[k])
        if (first) {
          // fokus na pierwszym błędzie – w długiej ankiecie inaczej wygląda, jakby „Zapisz” nie działało
          const target = document.getElementById(first === 'voivodeship' ? `${uid}-voiv` : first === 'categories' ? `${uid}-cat-0` : `${uid}-${first}`)
          target?.focus()
          target?.scrollIntoView?.({ block: 'center' })
          return
        }
        onSave({ ...p, name: p.name.trim(), email: p.email?.trim() || undefined, updated_at: new Date().toISOString() })
      }}
    >
      <p className="text-sm text-slate-600">Wymagane: nazwa, województwo oraz rodzaj inwestycji albo jej opis (min. 20 znaków). Resztę możesz uzupełnić później.</p>
      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
          <p className="font-medium">Nie zapisano – popraw {Object.keys(errors).length === 1 ? 'jedno pole' : `${Object.keys(errors).length} pola`}:</p>
          <ul className="mt-1 list-disc pl-5">
            {Object.values(errors).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <label htmlFor={`${uid}-name`} className="text-sm font-medium text-slate-800">
          Nazwa klienta
        </label>
        <input id={`${uid}-name`} className={input} value={p.name} onChange={(e) => set('name', e.target.value)} {...aria('name')} />
        {err('name')}
      </div>
      <div>
        <label htmlFor={`${uid}-email`} className="text-sm font-medium text-slate-800">
          E-mail klienta (opcjonalnie)
        </label>
        <input id={`${uid}-email`} type="email" autoComplete="off" className={input} value={p.email ?? ''} onChange={(e) => set('email', e.target.value)} {...aria('email')} />
        {err('email')}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-form`} className="text-sm font-medium text-slate-800">
            Forma prawna
          </label>
          <select id={`${uid}-form`} className={input} value={p.legal_form} onChange={(e) => set('legal_form', e.target.value as ClientProfile['legal_form'])}>
            {LEGAL_FORMS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-size`} className="text-sm font-medium text-slate-800">
            Wielkość
          </label>
          <select id={`${uid}-size`} className={input} value={p.size} onChange={(e) => set('size', e.target.value as ClientProfile['size'])}>
            {SIZES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-voiv`} className="text-sm font-medium text-slate-800">
            Województwo
          </label>
          <select id={`${uid}-voiv`} className={input} value={p.voivodeship} onChange={(e) => set('voivodeship', e.target.value)} {...aria('voivodeship')}>
            <option value="">– wybierz –</option>
            {VOIVODESHIPS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {err('voivodeship')}
        </div>
        <div>
          <label htmlFor={`${uid}-commune`} className="text-sm font-medium text-slate-800">
            Gmina (miejsce inwestycji)
          </label>
          <input id={`${uid}-commune`} className={input} value={p.commune ?? ''} onChange={(e) => set('commune', e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${uid}-pkd`} className="text-sm font-medium text-slate-800">
            PKD (opcjonalnie)
          </label>
          <input id={`${uid}-pkd`} className={input} value={p.pkd ?? ''} onChange={(e) => set('pkd', e.target.value)} placeholder="np. 55.20.Z" />
        </div>
        <div>
          <label htmlFor={`${uid}-stage`} className="text-sm font-medium text-slate-800">
            Etap firmy
          </label>
          <select id={`${uid}-stage`} className={input} value={p.stage} onChange={(e) => set('stage', e.target.value as ClientProfile['stage'])}>
            {STAGES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset {...aria('categories')}>
        <legend className="text-sm font-medium text-slate-800">Co klient chce sfinansować?</legend>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {CATEGORIES.map(([k, l], i) => (
            <label key={k} className="flex items-start gap-2 text-sm text-slate-800">
              <input
                id={i === 0 ? `${uid}-cat-0` : undefined}
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-indigo-700"
                checked={p.categories.includes(k)}
                onChange={(e) => set('categories', e.target.checked ? [...p.categories, k] : p.categories.filter((c: Category) => c !== k))}
              />
              {l}
            </label>
          ))}
        </div>
        {err('categories')}
      </fieldset>
      <div>
        <label htmlFor={`${uid}-desc`} className="text-sm font-medium text-slate-800">
          Opis planowanej inwestycji
        </label>
        <textarea
          id={`${uid}-desc`}
          rows={3}
          className={input}
          value={p.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="np. 3 domki noclegowe z sauną i fotowoltaiką na własnej działce"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-budget`} className="text-sm font-medium text-slate-800">
            Budżet projektu (zł)
          </label>
          <input id={`${uid}-budget`} inputMode="numeric" className={input} value={p.budget ?? ''} onChange={(e) => set('budget', num(e.target.value))} />
        </div>
        <div>
          <label htmlFor={`${uid}-own`} className="text-sm font-medium text-slate-800">
            Możliwy wkład własny (%)
          </label>
          <input
            id={`${uid}-own`}
            inputMode="numeric"
            className={input}
            value={p.own_contribution_pct ?? ''}
            onChange={(e) => set('own_contribution_pct', num(e.target.value) === undefined ? undefined : Math.min(100, num(e.target.value)!))}
          />
        </div>
      </div>
      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-5 py-3">
        <button type="submit" className={primary}>
          {isNew ? 'Zapisz i dopasuj nabory' : 'Zapisz zmiany'}
        </button>
        {onCancel && (
          <button type="button" className={secondary} onClick={onCancel}>
            Anuluj
          </button>
        )}
        {onDelete && (
          <div className="ml-auto">
            <DeleteClient name={initial.name} onConfirm={onDelete} />
          </div>
        )}
      </div>
    </form>
  )
}

function Results({
  profile,
  grants,
  sources,
  today,
  aiChecks,
  onOpenGrant,
  onAi,
}: {
  profile: ClientProfile
  grants: Grant[]
  sources: Source[]
  today: Date
  aiChecks: Record<string, AiMatch>
  onOpenGrant: (id: string) => void
  onAi: (p: ClientProfile, g: Grant) => Promise<string | null>
}) {
  const [showAll, setShowAll] = useState(false)
  const [q, setQ] = useState('')
  const ranked = useMemo(() => rankGrants(profile, grants, sources, today), [profile, grants, sources, today])
  const byId = new Map(grants.map((g) => [g.id, g]))
  const needle = q.trim().toLowerCase()
  const hit = (id: string) => {
    const g = byId.get(id)
    return !needle || !g || [g.title, g.institution, g.program?.name ?? '', g.call_number ?? ''].some((x) => x.toLowerCase().includes(needle))
  }
  const good = ranked.filter((r) => r.verdict !== 'nie_pasuje' && hit(r.grant_id))
  const rest = ranked.filter((r) => r.verdict === 'nie_pasuje' && hit(r.grant_id))

  // porównanie narzędzi dla tego klienta
  const compared = ranked.filter((r) => aiChecks[`${profile.id}:${r.grant_id}`])
  const agree = compared.filter((r) => aiChecks[`${profile.id}:${r.grant_id}`].verdict === r.verdict).length

  return (
    <section aria-labelledby="results-h" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 id="results-h" className="text-base font-semibold">
          Nabory dla: {profile.name}
        </h3>
        <p className="mt-1 text-sm text-slate-700">
          Pasuje: <strong>{ranked.filter((r) => r.verdict === 'pasuje').length}</strong> · może pasować:{' '}
          <strong>{ranked.filter((r) => r.verdict === 'moze_pasowac').length}</strong> · nie pasuje: {ranked.filter((r) => r.verdict === 'nie_pasuje').length} (z {ranked.length} otwartych i zapowiedzianych)
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Ocena regułami jest bezpłatna i natychmiastowa. „Sprawdź z AI” czyta ogłoszenie i daje drugą opinię z cytatami (płatne, ok. 1–3 gr za nabór). Wynik nie jest poradą
          – warunki zawsze potwierdź w ogłoszeniu.
        </p>
        {compared.length > 0 && (
          <p role="status" className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
            Porównanie narzędzi: AI sprawdziło {compared.length} {compared.length === 1 ? 'nabór' : 'nabory'}, zgodny werdykt z regułami w {agree} z {compared.length}.
          </p>
        )}
      </div>

      <label className="block text-sm font-medium text-slate-800">
        Szukaj w naborach dla klienta
        <input type="search" className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="tytuł, instytucja, program, numer naboru" />
      </label>
      {needle && (
        <p role="status" className="text-sm text-slate-600">
          Znaleziono: {good.length + rest.length} (pasujące: {good.length})
        </p>
      )}
      {good.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          {needle ? 'Brak pasujących naborów dla tego wyszukiwania.' : 'Brak pasujących naborów. Sprawdź ankietę albo listę „Nie pasuje” poniżej.'}
        </p>
      )}
      <ol className="space-y-3">
        {good.map((r) => (
          <ResultCard key={r.grant_id} r={r} g={byId.get(r.grant_id)!} source={sources.find((s) => s.id === byId.get(r.grant_id)?.source_id)} profile={profile} ai={aiChecks[`${profile.id}:${r.grant_id}`]} onOpenGrant={onOpenGrant} onAi={onAi} />
        ))}
      </ol>

      {rest.length > 0 && (
        <div>
          <button type="button" className={secondary} aria-expanded={showAll} onClick={() => setShowAll((x) => !x)}>
            {showAll ? 'Ukryj' : 'Pokaż'} „Nie pasuje” ({rest.length})
          </button>
          {showAll && (
            <ol className="mt-3 space-y-3">
              {rest.map((r) => (
                <ResultCard key={r.grant_id} r={r} g={byId.get(r.grant_id)!} source={sources.find((s) => s.id === byId.get(r.grant_id)?.source_id)} profile={profile} ai={aiChecks[`${profile.id}:${r.grant_id}`]} onOpenGrant={onOpenGrant} onAi={onAi} />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

function Pill({ verdict, score, prefix }: { verdict: Verdict; score: number; prefix: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${VERDICT_STYLE[verdict]}`}>
      {prefix}: {VERDICT_LABEL[verdict]} · {score}/100
    </span>
  )
}

function ResultCard({
  r,
  g,
  source,
  profile,
  ai,
  onOpenGrant,
  onAi,
}: {
  r: MatchResult
  g: Grant
  source?: Source
  profile: ClientProfile
  ai?: AiMatch
  onOpenGrant: (id: string) => void
  onAi: (p: ClientProfile, g: Grant) => Promise<string | null>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    setBusy(true)
    setError(null)
    setError(await onAi(profile, g))
    setBusy(false)
  }
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={() => onOpenGrant(g.id)} className="text-left font-semibold text-indigo-800 underline-offset-2 hover:underline">
            {g.title}
          </button>
          <p className="mt-0.5 text-xs text-slate-600">
            {source?.name ?? g.institution} · {g.closes_at ? `do ${formatDate(g.closes_at)}` : 'termin nieznany'}
            {r.estimated_grant !== undefined && ` · szacowana dotacja ok. ${fmt(r.estimated_grant)} zł`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill verdict={r.verdict} score={r.score} prefix="Reguły" />
          {ai && <Pill verdict={ai.verdict} score={ai.score} prefix="AI" />}
        </div>
      </div>

      <div className={`mt-4 grid gap-4 ${ai ? 'md:grid-cols-2' : ''}`}>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Ocena regułami</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {r.checks.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className={`w-4 shrink-0 font-bold ${CHECK_ICON[c.status].cls}`}>
                  {CHECK_ICON[c.status].icon}
                </span>
                <span>
                  <span className="sr-only">{CHECK_ICON[c.status].sr}: </span>
                  <strong className="font-medium">{c.label}:</strong> {c.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {ai && (
          <div aria-live="polite">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Opinia AI {ai.source_read ? '(przeczytało ogłoszenie)' : '(bez strony źródłowej)'}</h4>
            <p className="mt-2 text-sm text-slate-900">{ai.summary}</p>
            <ul className="mt-2 space-y-2 text-sm">
              {ai.conditions.map((c, i) => {
                const s = CHECK_ICON[AI_STATUS[c.status]]
                return (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true" className={`w-4 shrink-0 font-bold ${s.cls}`}>
                      {s.icon}
                    </span>
                    <span>
                      <span className="sr-only">{s.sr}: </span>
                      {c.condition}
                      {c.quote && <q className="mt-0.5 block border-l-2 border-slate-300 pl-2 text-xs italic text-slate-600">{c.quote}</q>}
                    </span>
                  </li>
                )
              })}
            </ul>
            {ai.missing_info.length > 0 && <p className="mt-2 text-xs text-slate-700">Brakuje: {ai.missing_info.join('; ')}.</p>}
            <p className="mt-2 text-xs text-slate-600">
              {ai.estimated_grant_pln ? `Szacunek AI: ok. ${fmt(ai.estimated_grant_pln)} zł · ` : ''}
              {ai.verdict === r.verdict ? 'Zgodne z regułami' : 'Inny werdykt niż reguły – sprawdź w ogłoszeniu'}
              {ai.cost_usd !== undefined && ` · koszt ok. ${(ai.cost_usd * 100).toFixed(2).replace('.', ',')} centa`}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={secondary} onClick={run} disabled={busy} aria-describedby={error ? `ai-err-${g.id}` : undefined}>
          {busy ? 'AI czyta ogłoszenie…' : ai ? 'Sprawdź ponownie z AI' : 'Sprawdź z AI'}
        </button>
        <a href={g.source_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-700 underline underline-offset-2">
          Ogłoszenie ↗
        </a>
        {error && (
          <p id={`ai-err-${g.id}`} role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}
