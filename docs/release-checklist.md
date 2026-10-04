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
