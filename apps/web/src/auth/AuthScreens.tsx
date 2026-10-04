import { useId, useState } from 'react'
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  TRIAL_DAYS,
  login,
  loginPasswordless,
  register,
  validateLogin,
  validateRegister,
  type AuthStore,
  type Errors,
} from './session'

type Mode = 'login' | 'register' | 'magic-sent' | 'reset' | 'reset-sent'

interface Props {
  store: AuthStore
  today: Date
  onChange: (s: AuthStore) => void
}

const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm aria-[invalid=true]:border-rose-600'
const primary =
  'w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
const secondary =
  'w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600'
const linkBtn = 'font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900'

export function AuthScreens({ store, today, onChange }: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')

  return (
    <div className="grid min-h-screen bg-slate-100 lg:grid-cols-[1fr_minmax(420px,560px)]">
      <BrandPanel />
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <p className="mb-6 text-lg font-semibold text-slate-900 lg:hidden">Radar Grantów</p>
          {mode === 'login' && (
            <LoginForm
              store={store}
              initialEmail={email}
              onSuccess={onChange}
              onRegister={() => setMode('register')}
              onReset={(e) => {
                setEmail(e)
                setMode('reset')
              }}
              onMagic={(e) => {
                setEmail(e)
                setMode('magic-sent')
              }}
            />
          )}
          {mode === 'register' && <RegisterForm store={store} today={today} onSuccess={onChange} onLogin={() => setMode('login')} />}
          {mode === 'magic-sent' && (
            <Notice
              title="Sprawdź skrzynkę"
              body={
                <>
                  Wysłaliśmy link logowania na <strong>{email}</strong>. Link jest ważny 1 godzinę.
                </>
              }
            >
              <button
                type="button"
                className={primary}
                onClick={() => {
                  const r = loginPasswordless(store, email)
                  if ('store' in r) onChange(r.store)
                  else setMode('login')
                }}
              >
                Otwórz link z e-maila (symulacja)
              </button>
              <button type="button" className={secondary} onClick={() => setMode('login')}>
                Wróć do logowania
              </button>
            </Notice>
          )}
          {mode === 'reset' && (
            <ResetForm
              initialEmail={email}
              onSent={(e) => {
                setEmail(e)
                setMode('reset-sent')
              }}
              onBack={() => setMode('login')}
            />
          )}
          {mode === 'reset-sent' && (
            <Notice
              title="Link do zmiany hasła wysłany"
              body={
                <>
                  Jeśli konto <strong>{email}</strong> istnieje, dostaniesz e-mail z linkiem do ustawienia nowego hasła.
                </>
              }
            >
              <button type="button" className={secondary} onClick={() => setMode('login')}>
                Wróć do logowania
              </button>
            </Notice>
          )}
          <p className="mt-8 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
            Prototyp: konto demo <strong>{DEMO_EMAIL}</strong> / <strong>{DEMO_PASSWORD}</strong>. Dane zapisują się tylko w tej przeglądarce.
          </p>
        </div>
      </main>
    </div>
  )
}

function BrandPanel() {
  return (
    <aside className="hidden flex-col justify-between bg-slate-900 p-12 text-slate-100 lg:flex" aria-label="O aplikacji">
      <p className="text-lg font-semibold">Radar Grantów</p>
      <div className="max-w-md">
        <h2 className="text-3xl font-semibold leading-tight text-white [text-wrap:balance]">Wszystkie nabory z Twoich stron na jednej osi czasu.</h2>
        <p className="mt-4 text-slate-300">
          Agent codziennie sprawdza strony LGD, ARiMR, PARP i programów regionalnych. Ty widzisz, co się otwiera, do kiedy i dla kogo to jest.
        </p>
        <svg viewBox="0 0 400 120" className="mt-10 w-full" aria-hidden="true">
          <line x1="0" y1="110" x2="400" y2="110" stroke="#334155" />
          <line x1="190" y1="0" x2="190" y2="115" stroke="#f43f5e" strokeWidth="2" />
          {[
            { y: 20, a: 30, s: 110, e: 200, c: '#f59e0b' },
            { y: 55, a: 90, s: 150, e: 330, c: '#0284c7' },
            { y: 90, a: 20, s: 60, e: 260, c: '#059669' },
          ].map((r) => (
            <g key={r.y}>
              <rect x={r.s} y={r.y - 5} width={r.e - r.s} height="10" rx="5" fill={r.c} />
              <circle cx={r.a} cy={r.y} r="6" fill="#0f172a" stroke="#e2e8f0" strokeWidth="2" />
              <rect x={r.e - 6} y={r.y - 6} width="12" height="12" transform={`rotate(45 ${r.e} ${r.y})`} fill="#e2e8f0" />
            </g>
          ))}
        </svg>
      </div>
      <p className="text-xs text-slate-400">4uai · prototyp</p>
    </aside>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-rose-800">
          {error}
        </p>
      )}
    </div>
  )
}

const a11y = (id: string, err?: string) => ({ id, 'aria-invalid': err ? true : undefined, 'aria-describedby': err ? `${id}-err` : undefined })

function focusFirst(uid: string, errs: object) {
  const k = Object.keys(errs)[0]
  if (k) document.getElementById(`${uid}-${k}`)?.focus()
}

function LoginForm({
  store,
  initialEmail,
  onSuccess,
  onRegister,
  onReset,
  onMagic,
}: {
  store: AuthStore
  initialEmail: string
  onSuccess: (s: AuthStore) => void
  onRegister: () => void
  onReset: (email: string) => void
  onMagic: (email: string) => void
}) {
  const uid = useId()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors<'email' | 'password'>>({})
  const [formError, setFormError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateLogin(email, password)
    setErrors(errs)
    setFormError('')
    if (Object.keys(errs).length) return focusFirst(uid, errs)
    const r = login(store, email, password)
    if ('error' in r) setFormError(r.error)
    else onSuccess(r.store)
  }

  const magic = () => {
    const errs = validateLogin(email, 'x')
    setErrors(errs)
    if (errs.email) return focusFirst(uid, errs)
    onMagic(email.trim())
  }

  return (
    <section aria-labelledby={`${uid}-h`}>
      <h1 id={`${uid}-h`} className="text-2xl font-semibold text-slate-900">
        Zaloguj się
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Nie masz konta?{' '}
        <button type="button" className={linkBtn} onClick={onRegister}>
          Załóż konto – {TRIAL_DAYS} dni za darmo
        </button>
      </p>

      <button
        type="button"
        className={`${secondary} mt-6`}
        onClick={() => {
          const r = login(store, DEMO_EMAIL, DEMO_PASSWORD)
          if ('store' in r) onSuccess(r.store)
        }}
      >
        Kontynuuj z Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-600" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-300" /> lub e-mailem <span className="h-px flex-1 bg-slate-300" />
      </div>

      <form noValidate onSubmit={submit} className="space-y-4" aria-label="Logowanie">
        {formError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
            {formError}
          </p>
        )}
        <Field id={`${uid}-email`} label="E-mail" error={errors.email}>
          <input {...a11y(`${uid}-email`, errors.email)} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field id={`${uid}-password`} label="Hasło" error={errors.password}>
          <input
            {...a11y(`${uid}-password`, errors.password)}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="flex justify-end">
          <button type="button" className={`${linkBtn} text-sm`} onClick={() => onReset(email)}>
            Nie pamiętasz hasła?
          </button>
        </div>
        <button type="submit" className={primary}>
          Zaloguj się
        </button>
        <button type="button" className={secondary} onClick={magic}>
          Wyślij mi link logowania
        </button>
      </form>
    </section>
  )
}

function RegisterForm({ store, today, onSuccess, onLogin }: { store: AuthStore; today: Date; onSuccess: (s: AuthStore) => void; onLogin: () => void }) {
  const uid = useId()
  const [d, setD] = useState({ name: '', email: '', password: '', org: '', terms: false })
  const [errors, setErrors] = useState<ReturnType<typeof validateRegister>>({})
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateRegister(d, store.accounts)
    setErrors(errs)
    if (Object.keys(errs).length) return focusFirst(uid, errs)
    onSuccess(register(store, d, today))
  }

  return (
    <section aria-labelledby={`${uid}-h`}>
      <h1 id={`${uid}-h`} className="text-2xl font-semibold text-slate-900">
        Załóż konto
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {TRIAL_DAYS} dni pełnej wersji bez karty. Masz już konto?{' '}
        <button type="button" className={linkBtn} onClick={onLogin}>
          Zaloguj się
        </button>
      </p>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4" aria-label="Rejestracja">
        <Field id={`${uid}-name`} label="Imię i nazwisko" error={errors.name}>
          <input {...a11y(`${uid}-name`, errors.name)} autoComplete="name" value={d.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
        </Field>
        <Field id={`${uid}-email`} label="E-mail służbowy" error={errors.email}>
          <input {...a11y(`${uid}-email`, errors.email)} type="email" autoComplete="email" value={d.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
        </Field>
        <Field id={`${uid}-password`} label="Hasło (min. 8 znaków)" error={errors.password}>
          <input
            {...a11y(`${uid}-password`, errors.password)}
            type="password"
            autoComplete="new-password"
            value={d.password}
            onChange={(e) => set('password', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field id={`${uid}-org`} label="Nazwa firmy" error={errors.org}>
          <input {...a11y(`${uid}-org`, errors.org)} autoComplete="organization" value={d.org} onChange={(e) => set('org', e.target.value)} className={inputCls} placeholder="np. Pensjonat pod Lasem" />
        </Field>
        <div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              {...a11y(`${uid}-terms`, errors.terms)}
              type="checkbox"
              checked={d.terms}
              onChange={(e) => set('terms', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-indigo-700"
            />
            <span>Akceptuję regulamin i politykę prywatności.</span>
          </label>
          {errors.terms && (
            <p id={`${uid}-terms-err`} className="mt-1 text-xs text-rose-800">
              {errors.terms}
            </p>
          )}
        </div>
        <button type="submit" className={primary}>
          Załóż konto i firmę
        </button>
      </form>
    </section>
  )
}

function ResetForm({ initialEmail, onSent, onBack }: { initialEmail: string; onSent: (e: string) => void; onBack: () => void }) {
  const uid = useId()
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState('')
  return (
    <section aria-labelledby={`${uid}-h`}>
      <h1 id={`${uid}-h`} className="text-2xl font-semibold text-slate-900">
        Zmień hasło
      </h1>
      <p className="mt-1 text-sm text-slate-600">Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.</p>
      <form
        noValidate
        className="mt-6 space-y-4"
        aria-label="Reset hasła"
        onSubmit={(e) => {
          e.preventDefault()
          const errs = validateLogin(email, 'x')
          if (errs.email) {
            setError(errs.email)
            document.getElementById(`${uid}-email`)?.focus()
            return
          }
          onSent(email.trim())
        }}
      >
        <Field id={`${uid}-email`} label="E-mail" error={error}>
          <input {...a11y(`${uid}-email`, error)} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <button type="submit" className={primary}>
          Wyślij link
        </button>
        <button type="button" className={secondary} onClick={onBack}>
          Wróć do logowania
        </button>
      </form>
    </section>
  )
}

function Notice({ title, body, children }: { title: string; body: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby="notice-h" role="status">
      <h1 id="notice-h" className="text-2xl font-semibold text-slate-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-700">{body}</p>
      <div className="mt-6 space-y-3">{children}</div>
    </section>
  )
}
