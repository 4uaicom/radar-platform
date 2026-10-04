# Radar Platform

To jest nowy, czysty projekt produktu dla Radaru Grantów.

## Cel
Stworzyć realną platformę do:
- zarządzania organizacją i użytkownikami,
- monitorowania źródeł grantowych,
- przeglądu naborów i klientów,
- dopasowania klientów do programów,
- rozwoju kolejnych modułów: kalkulatory, raporty, AI.

## Założenia
- jedna baza Supabase dla MVP,
- wieloorganizacyjny model danych,
- `organization_id` w każdej tabeli z danymi klienta,
- RLS na poziomie tabel,
- dashboard operacyjny jako podstawa produktu,
- moduły jako osobne obszary funkcjonalne.

## Struktura
- `apps/web` – frontend aplikacji
- `apps/api` – backend / integracje / logika serwera
- `docs` – wymagania, architektura, model danych
- `supabase` – schemat, migracje, RLS, seed

## Priorytet MVP
1. Auth i organizacja
2. Zarządzanie użytkownikami i rolami
3. Zarządzanie źródłami
4. Lista naborów i statusy
5. Klienci i dopasowanie
6. Ustawienia i harmonogramy
7. Moduły drugiego etapu: kalkulatory, raporty

## Zasada
Nie mieszamy prototypu z produktem. To jest nowy projekt od czystej karty.
