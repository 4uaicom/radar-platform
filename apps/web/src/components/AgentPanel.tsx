import type { AgentRun } from '../lib/agentRun'
import { countProblems, formatTime } from '../lib/agentRun'
import { InfoTip } from './InfoTip'

interface ButtonProps {
  running: { done: number; total: number; current: string } | null
  onCheck: () => void
}

export function CheckNowButton({ running, onCheck }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={!!running}
      aria-describedby="check-progress"
      className="inline-flex items-center gap-2 rounded-lg border border-indigo-700 bg-white px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <span aria-hidden="true" className={running ? 'inline-block animate-spin motion-reduce:animate-none' : ''}>
        ↻
      </span>
      {running ? `Sprawdzam ${running.done}/${running.total}…` : 'Sprawdź teraz'}
    </button>
  )
}

/** 1 stronę, 2–4 strony, 5+ stron (12–14 stron) */
export function pagesWord(n: number): string {
  if (n === 1) return 'stronę'
  const d = n % 10
  const t = n % 100
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'strony' : 'stron'
}

export function RunResult({ run, onDismiss, onShowLog }: { run: AgentRun; onDismiss: () => void; onShowLog: () => void }) {
  const problems = run.errors.filter((e) => e.kind !== 'w_przygotowaniu')
  const pending = run.errors.filter((e) => e.kind === 'w_przygotowaniu')
  const hasErrors = problems.length > 0
  return (
    <div
      role="status"
      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        hasErrors ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-300 bg-emerald-50 text-emerald-950'
      }`}
    >
      <div>
        <p className="font-semibold">
          Sprawdzono {run.checked} {pagesWord(run.checked)} ({formatTime(run.finished_at)}) · nowe nabory: {run.new_grants} · zmienione: {run.updated_grants}
          {hasErrors && ` · problemy: ${problems.length}`}
        </p>
        {hasErrors && (
          <ul className="mt-1 list-disc pl-5">
            {problems.map((e) => (
              <li key={e.source}>
                <strong>{e.source}:</strong> {e.message}
              </li>
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span>
              Czytnik w przygotowaniu: {pending.length} {pending.length === 1 ? 'strona' : pagesWord(pending.length) === 'strony' ? 'strony' : 'stron'}
            </span>
            <InfoTip
              label="Które strony czekają na czytnik"
              text={`${pending.map((e) => e.source).join(', ')}. Dla nich pokazujemy ostatnio odczytane dane albo sprawdzasz je ręcznie.`}
            />
          </p>
        )}
        {run.test_mode && <p className="mt-1 text-xs">Tryb testowy: nabory to prawdziwe dane odczytane 26.09.2026, a samo sprawdzanie jest jeszcze symulowane.</p>}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onShowLog} className="font-medium underline underline-offset-2">
          Historia sprawdzeń
        </button>
        <button type="button" onClick={onDismiss} className="font-medium underline underline-offset-2" aria-label="Zamknij wynik sprawdzania">
          Zamknij
        </button>
      </div>
    </div>
  )
}

export function RunLog({ runs }: { runs: AgentRun[] }) {
  return (
    <section aria-labelledby="run-log" className="h-fit rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="run-log" tabIndex={-1} className="text-base font-semibold focus:outline-none">
        Historia sprawdzeń
      </h2>
      {runs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Agent jeszcze nie sprawdzał stron. Użyj przycisku „Sprawdź teraz”.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {runs.slice(0, 10).map((r) => (
            <li key={r.id} className="border-l-2 border-slate-200 pl-3 text-sm">
              <p className="font-medium text-slate-900">
                {formatTime(r.finished_at)} · {r.trigger}
                {r.test_mode && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">test</span>}
              </p>
              <p className="text-xs text-slate-600">
                stron: {r.checked} · pominięte: {r.skipped} · nowe: {r.new_grants} · zmienione: {r.updated_grants} · problemy: {countProblems(r)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
