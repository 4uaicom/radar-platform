/** Stopka na kontraście – na każdym ekranie (logowanie, aplikacja, ustawienia). */
export function SiteFooter({ year = new Date().getFullYear() }: { year?: number }) {
  return (
    <footer className="bg-slate-900 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 text-sm sm:px-6">
        <p>
          © {year} Radar Grantów ·{' '}
          <a href="https://4uai.com.pl" target="_blank" rel="noreferrer" className="font-medium text-white underline underline-offset-2 hover:text-indigo-200">
            4uai
          </a>
          . Wszelkie prawa zastrzeżone.
        </p>
        <p className="text-slate-300">Dane o naborach pochodzą ze stron instytucji – przed decyzją sprawdź je u źródła.</p>
      </div>
    </footer>
  )
}
