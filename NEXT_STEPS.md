NEXT STEPS — radar-platform

Krótko: wybierz jedną z opcji, a ja to zrobię.

Opcje:
- Migrate (recommended): przenieść `prototype` → `apps/web` i utworzyć `apps/api` dla edge/workerów. Po migracji uruchamiamy testy i CI.
- CI/CD: dodać GitHub Actions (lint/test/build) i wdrożenie migracji Supabase.
- Seed: dodać skrypt seed SQL dla przykładowej organizacji i zainstalować do Supabase testowego projektu.

Jeśli wybierzesz "Migrate", proponowany workflow (wykonaję to za Ciebie):

1) Utworzę foldery:

```powershell
mkdir -Force "c:\projekt4ui\platformy\radar-platform\apps\web"
mkdir -Force "c:\projekt4ui\platformy\radar-platform\apps\api"
```

2) Skopiuję istotne pliki z prototypu:

```powershell
robocopy "c:\projekt4ui\radar-grantow\prototype\src" "c:\projekt4ui\platformy\radar-platform\apps\web\src" /E
robocopy "c:\projekt4ui\radar-grantow\prototype\package.json" "c:\projekt4ui\platformy\radar-platform\apps\web\" /COPY
```

3) Zainicjuję `apps/web/package.json` (zależności i skrypty), uruchomię `npm ci` i `npm test` w `apps/web`.

4) Utworzę `apps/api` z prostym Cloudflare Worker / Edge Function wrapperem (endpointy `/api/check` i `/api/ai-match`) i przeniosę `prototype/worker`.

5) Commit + push do `origin/main`.

Potrzebuję potwierdzenia: mam zacząć migrację teraz, czy wolisz najpierw dodać CI albo seed?
