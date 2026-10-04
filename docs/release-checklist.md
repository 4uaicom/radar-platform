# Release checklist

## Before merge to develop
- [ ] task ma opis i kryteria akceptacji
- [ ] testy lokalne przechodzą
- [ ] build się kompiluje
- [ ] brak błędów w lint / TS
- [ ] dane i migracje są przemyślane
- [ ] nowe funkcje nie naruszają istniejących modułów

## Before staging deploy
- [ ] branch zmergowany do `develop`
- [ ] deploy do staging działa
- [ ] smoke test przechodzi
- [ ] logowanie działa
- [ ] organizacja / role działają
- [ ] dane z tenant model są poprawne
- [ ] RLS nie pozwala na cross-tenant access

## Before production deploy
- [ ] staging zaakceptowany przez QA
- [ ] changelog przygotowany
- [ ] wersja ma numer i opis
- [ ] backup / rollback przygotowany
- [ ] migracje bazy sprawdzone
- [ ] testy bezpieczeństwa wykonane
- [ ] lista zmian przekazana do klienta lub zespołu

## After production deploy
- [ ] decyzja o monitoringu / alertach
- [ ] sprawdzenie logów
- [ ] sprawdzenie wydajności i błędów
- [ ] potwierdzenie, że klienci mogą normalnie pracować

## Quick commands

- Run web tests:

```bash
cd apps/web
npm ci
npm test
```

- Run migrations (local):

```bash
for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed_demo.sql
```

## Release notes template

- **Release:** vX.Y.Z
- **Date:** YYYY-MM-DD
- **Summary:** Short paragraph about changes
- **Migration notes:** list manual steps and breaking changes
- **Testing performed:** unit/e2e/manual checks

