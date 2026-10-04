# Model wieloorganizacyjny (tenant model)

## Założenie
Jedna baza Supabase, wiele organizacji, pełna izolacja danych logiczna.

## Każda tabela z danymi klienta ma:
- `organization_id`
- `created_at`
- `updated_at`
- `created_by` (jeśli ma sens)

## Zasada bezpieczeństwa
Żaden użytkownik nie ma dostępu do danych poza swoją organizacją.

## RLS
Dla każdej tabeli z danymi:
- tylko użytkownik z aktywnym membership w tej organizacji ma dostęp,
- `organization_id` musi pasować do organizacji użytkownika,
- dostęp do katalogów ogólnych jest ograniczony do odczytu lub weryfikacji.

## Minimalny zestaw tabel
- organizations
- memberships
- users / profiles
- sources
- grants
- client_profiles
- client_ai_checks
- agent_runs
- settings

## MVP
Na start nie potrzebujemy osobnej bazy dla każdej organizacji. Wystarczy dobry model tenantowy z RLS i dobrym podziałem danych.
