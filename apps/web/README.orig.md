# Radar Grantów – prototyp (etap 1)

Klikalny prototyp na danych przykładowych. Nabory w `src/data/mock.ts` nie są prawdziwe; katalog 11 portali – tak.
Logowanie, firmy i ustawienia są symulowane w pamięci przeglądarki (docelowo Supabase Auth + Stripe).

Konto demo: `demo@radar-grantow.pl` / `demo1234`

## Uruchomienie

```
npm install
npm run dev          # http://localhost:5173
```

## Testy

```
npm test                          # Vitest – logika i scenariusze UI (61 testów)
npx playwright install chromium   # jednorazowo
npm run test:e2e                  # Playwright – przepływy, klawiatura, axe WCAG 2.1 AA
npm run build:single              # jeden plik HTML do podglądu
```

## Co jest w prototypie

- Oś czasu: ① publikacja → ② okres naboru → ③ zamknięcie, linia „Dziś”, zakres 2/4/6 miesięcy; sekcja „Zapowiedzi”
- Modal: kwoty, terminy, kto/na co, streszczenie AI, dokumenty, źródła, program z linkiem, „Sprawdź” dla niepewnych pól, ręczna korekta dat, .ics
- Etapy wniosku (Analizuję → … → Przyznany/Odrzucony) i „Dla kogo” – jako pigułki w modalu i na kartach
- Lista, filtry (źródło, region, status, mój status, dla kogo), „Nie dla mnie”, przypomnienia < 7 dni
- Baza stron: Katalog Radaru vs „Twoja strona”, limit planu, kategorie, agregatory, częstotliwość per strona
- Programy: ukrywanie w bazie stron i z modala
- Logowanie (hasło, link e-mail, Google), rejestracja z 14-dniowym trialem, reset hasła
- Menu konta z przełączaniem firm, ikona ustawień: firma, plan, zespół i zaproszenia, harmonogram sprawdzania

## Struktura

```
src/App.tsx               widok naborów i bazy stron (jedna firma)
src/Root.tsx              logowanie, przełączanie firm, menu konta
src/auth/                 sesja, plany, harmonogram, ekrany logowania, ustawienia
src/components/           oś czasu, lista, modal, filtry, baza stron, etykiety
src/lib/grants.ts         logika: statusy, filtry, sortowanie, walidacja, .ics
```
