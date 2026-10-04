-- Demo seed for radar-platform
-- Inserts a demo organization, a member placeholder, a few sources and sample grants.

-- Use a fixed UUID for reproducibility
\set DEMO_ORG '11111111-1111-1111-1111-111111111111'

insert into public.organizations (id, name, plan_id, scan_frequency, scan_hour)
values (:'DEMO_ORG'::uuid, 'Demo 4uaicom', 'trial', 'codziennie', 6)
on conflict (id) do nothing;

-- Add a few own sources for the demo organization
insert into public.sources (id, name, url, type, region, category, kind, origin, organization_id, active_default, notes)
values
  (gen_random_uuid(), 'Demo - Urząd Marszałkowski', 'https://demo.regional.example/nabory', 'regionalny', 'małopolskie', 'Regionalny – Małopolskie', 'oficjalne', 'wlasna', :'DEMO_ORG'::uuid, true, 'Demo source'),
  (gen_random_uuid(), 'Demo - PARP excerpt', 'https://demo.parp.example/harmonogram', 'PARP', 'cała Polska', 'Krajowy – MŚP', 'oficjalne', 'wlasna', :'DEMO_ORG'::uuid, true, 'Demo PARP'),
  (gen_random_uuid(), 'Demo - Lokalny LGD', 'https://demo.lgd.example/ogloszenia', 'LGD', 'małopolskie', 'LGD lokalny', 'oficjalne', 'wlasna', :'DEMO_ORG'::uuid, true, 'LGD demo');

-- Create sample grants for the first two sources
insert into public.grants (id, source_id, title, program_name, opens_at, closes_at, max_grant, funding_percent, source_url, extractor)
select gen_random_uuid(), s.id, 'Wsparcie inwestycji turystycznych', 'Regionalny Program Demo', '2026-10-01'::date, '2026-11-30'::date, 200000, 65, s.url || '/nabory/1', 'manual'
from public.sources s
where s.organization_id = :'DEMO_ORG'::uuid
and s.name like '%Urząd Marszałkowski%' limit 1
on conflict do nothing;

insert into public.grants (id, source_id, title, program_name, opens_at, closes_at, max_grant, funding_percent, source_url, extractor)
select gen_random_uuid(), s.id, 'Dotacje na cyfryzację MŚP', 'PARP Demo Program', '2026-09-15'::date, '2026-12-31'::date, 100000, 50, s.url || '/nabory/2', 'manual'
from public.sources s
where s.organization_id = :'DEMO_ORG'::uuid
and s.name like '%PARP%' limit 1
on conflict do nothing;

-- Link public catalog sources (optional)
insert into public.organization_sources (organization_id, source_id, active)
select :'DEMO_ORG'::uuid, s.id, true
from public.sources s
where s.origin = 'katalog'
limit 3
on conflict do nothing;

-- Simple note: memberships/users left to the deployer (create users then insert into memberships)

-- End of demo seed
