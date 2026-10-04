# Release process for Radar Platform

## Cel
Zabezpieczyć rozwój produktu przed wdrożeniem do klienta. Każda poprawka i nowa funkcja musi przejść przez kontrolowany proces testów i releasu.

## Środowiska

### 1) Development
- lokalny rozwój dewelopera
- szybkie testy jednostkowe
- dane testowe / mocki
- nie używa się do pracy klientów

### 2) Staging
- środowisko testowe zbliżone do produkcji
- uruchamiane po merge do develop
- testy manualne, QA, smoke tests
- klient nie widzi tej wersji, chyba że jest dedykowany test

### 3) Production
- wersja aktywna dla klientów
- tylko po zaakceptowaniu release i testach
- każda zmiana ma wersję i changelog

## Branch strategy

### `develop`
- główny branch integracyjny
- zbiera zmiany z feature branches
- wersje testowe i staging

### `main`
- tylko stabilne, zaakceptowane do produkcji
- deploy do produkcji

### `feature/*`
- nowe funkcje i poprawki
- wzorcowo `feature/dashboard-mvp`, `feature/tenant-rls`

### `release/*`
- wersje przygotowane do wdrożenia klienta
- finalne testy, poprawki, metadata release

## Versioning
Używamy semver:
- `MAJOR.MINOR.PATCH`

Przykłady:
- `1.0.0` — pierwsza stabilna wersja produktu
- `1.1.0` — nowe moduły / funkcje
- `1.1.1` — poprawka błędu
- `2.0.0` — zmiana architektury lub wymagająca migracja

## Release flow

1. Tworzymy `feature/*` z taska.
2. Wykonujemy testy lokalne i unit tests.
3. Merge do `develop`.
4. Deploy do staging.
5. Testy manualne + smoke tests.
6. Jeśli wszystko OK, tworzymy `release/*`.
7. Finalna akceptacja QA.
8. Merge `release/*` do `main`.
9. Deploy do produkcji.
10. Tworzymy release notes i tag w git.

## Dla klienta
- klient nie dostaje wersji z branchów roboczych
- klient dostaje tylko zatwierdzoną wersję z `main`
- każda wersja ma datę, opis i testy

## Minimalne wymagania przed release
- testy jednostkowe przechodzą
- testy end-to-end wykonane na staging
- smoke test ok
- brak błędów w buildzie
- RLS i access control sprawdzone
- dane testowe nie mieszają się z produkcją
- migracje bazy są zrobione i przetestowane
- changelog przygotowany

## Rollback strategy
- każda produkcyjna wersja ma zapisany tag / release
- w razie problemów: wracamy do poprzedniej stabilnej wersji
- rollback musi być możliwy bez utraty danych klientów

## Zasada bezpieczeństwa
- nie wdrażamy do produkcji bez testów
- nie uruchamiamy funkcji na produkcji bez release checklist
- nie publikujemy mocków / demo danych do klienta
- każdy deploy ma opis zmian i status testu
