import { useEffect, useId, useState } from 'react'

/**
 * Ikona z podpowiedzią (WCAG 1.4.13): pokazuje się po najechaniu, fokusie i kliknięciu (dotyk),
 * zostaje przy najechaniu na samą podpowiedź, zamyka ją Escape.
 */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <span className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-400 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3.25a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8ZM7.25 6.5h1.5v5.5h-1.5V6.5Z" />
        </svg>
      </button>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className="absolute left-0 top-full z-30 mt-2 w-64 max-w-[80vw] rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg"
      >
        {text}
      </span>
    </span>
  )
}
