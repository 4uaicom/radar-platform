import type { Grant } from '../types'

/**
 * PRAWDZIWE NABORY odczytane ze stron katalogu 26.09.2026 (złoty zbiór agent-lab/expected/golden.json).
 * Przepisane z golden.json (wszystkie pola z odczytu, bez dopisków). Po weryfikacji danych zaktualizuj oba pliki.
 * Daty są stałe: z czasem nabory przechodzą w status „zamknięty”, dopóki agent nie pobierze nowych.
 */
export const DATA_AS_OF = '2026-09-26'

export const realGrants: Grant[] = [
  {
    "id": "fesl-593",
    "source_id": "c04",
    "title": "Usługi rozwojowe dla kadr administracji samorządowej",
    "institution": "Wojewódzki Urząd Pracy w Katowicach",
    "announced_at": "2026-08-31",
    "call_number": "FESL.05.14-IP.02-350/26",
    "opens_at": "2026-08-31",
    "closes_at": "2026-10-30",
    "budget_total": 3000000,
    "funding_percent": 85,
    "beneficiaries": "Jednostki administracji samorządowej i ZIT w woj. śląskim",
    "scope": "Szkolenia i studia podyplomowe kadr JST (kompetencje cyfrowe i zielone, zarządzanie kryzysowe, cyberbezpieczeństwo)",
    "required_docs": [
      "Formularz wniosku z instrukcją",
      "Kryteria wyboru projektów",
      "Wzór umowy",
      "Informacja o kwalifikowalności"
    ],
    "summary_ai": "Dane odczytane automatycznie ze strony FE SL 2021-2027 26.09.2026 (odczyt: karta). Przed decyzją sprawdź ogłoszenie u źródła. Uwaga: Rozbieżność: lista – konkurencyjny, karta – niekonkurencyjny",
    "source_url": "https://funduszeue.slaskie.pl/nabory/lsi/593/",
    "program": {
      "name": "Fundusze Europejskie dla Śląskiego 2021-2027, Działanie 5.14",
      "url": "https://funduszeue.slaskie.pl/"
    },
    "attachments": [],
    "confidence": {
      "opens_at": 0.5,
      "closes_at": 0.5,
      "budget_total": 0.9,
      "funding_percent": 0.9
    },
    "manual_overrides": {}
  },
  {
    "id": "fesl-559",
    "source_id": "c04",
    "title": "Ponowne wykorzystanie terenów poprzemysłowych, zdewastowanych, zdegradowanych na cele rozwojowe regionu",
    "institution": "Zarząd Województwa Śląskiego",
    "announced_at": "2026-06-30",
    "call_number": "FESL.10.09-IZ.01-349/26",
    "opens_at": "2026-06-30",
    "closes_at": "2026-09-30",
    "budget_total": 46000000,
    "funding_percent": 85,
    "beneficiaries": "Wyłącznie Gmina Pietrowice Wielkie (projekt wskazany)",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony FE SL 2021-2027 26.09.2026 (odczyt: karta). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://funduszeue.slaskie.pl/nabory/lsi/559/",
    "program": {
      "name": "FE SL 2021-2027, Działanie 10.9",
      "url": "https://funduszeue.slaskie.pl/"
    },
    "attachments": [],
    "confidence": {
      "opens_at": 0.9,
      "closes_at": 0.9,
      "budget_total": 0.9,
      "funding_percent": 0.9
    },
    "manual_overrides": {}
  },
  {
    "id": "fesl-449",
    "source_id": "c04",
    "title": "9.2 Rozwój ZIT",
    "institution": "Zarząd Województwa Śląskiego",
    "announced_at": "2025-11-20",
    "call_number": "FESL.09.02-IZ.01-305/25",
    "opens_at": "2025-11-20",
    "closes_at": "2027-12-31",
    "budget_total": 7000000,
    "funding_percent": 85,
    "beneficiaries": "Związki ZIT",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony FE SL 2021-2027 26.09.2026 (odczyt: karta). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://funduszeue.slaskie.pl/nabory/lsi/449/",
    "program": {
      "name": "FE SL 2021-2027, Działanie 9.2",
      "url": "https://funduszeue.slaskie.pl/"
    },
    "attachments": [],
    "confidence": {
      "opens_at": 0.9,
      "closes_at": 0.9,
      "budget_total": 0.9,
      "funding_percent": 0.9
    },
    "manual_overrides": {}
  },
  {
    "id": "fesl-558",
    "source_id": "c04",
    "title": "5.10 EURES dla PSZ",
    "institution": "FE SL 2021-2027",
    "announced_at": "2026-06-30",
    "call_number": "FESL.05.10-IP.02-348/26",
    "opens_at": "2026-06-30",
    "closes_at": "2026-09-30",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony FE SL 2021-2027 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://funduszeue.slaskie.pl/nabory/lsi/558/",
    "attachments": [],
    "confidence": {
      "opens_at": 0.8,
      "closes_at": 0.8
    },
    "manual_overrides": {}
  },
  {
    "id": "fesl-557",
    "source_id": "c04",
    "title": "5.9 EURES-T Beskydy",
    "institution": "FE SL 2021-2027",
    "announced_at": "2026-06-30",
    "call_number": "FESL.05.09-IP.02-347/26",
    "opens_at": "2026-06-30",
    "closes_at": "2026-09-30",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony FE SL 2021-2027 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://funduszeue.slaskie.pl/nabory/lsi/557/",
    "attachments": [],
    "confidence": {
      "opens_at": 0.8,
      "closes_at": 0.8
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-industrylab-green",
    "source_id": "c06",
    "title": "INDUSTRYLAB GREEN",
    "institution": "PARP (operator: DGA S.A.)",
    "announced_at": "2026-08-01",
    "opens_at": "2026-08-01",
    "closes_at": "2026-09-30",
    "max_grant": 400000,
    "funding_percent": 100,
    "beneficiaries": "Start-upy, mikro i małe przedsiębiorstwa do 5 lat, technologie GOZ",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: karta). Przed decyzją sprawdź ogłoszenie u źródła. Uwaga: Rozbieżność: harmonogram 01.08–30.09.2026, karta 30.01.2026–31.08.2027 – do wyjaśnienia",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/dga-s-a-industry-lab-green",
    "program": {
      "name": "FENG",
      "url": "https://www.funduszeeuropejskie.gov.pl/"
    },
    "attachments": [],
    "confidence": {
      "opens_at": 0.5,
      "closes_at": 0.5,
      "max_grant": 0.9,
      "funding_percent": 0.9
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-horizon-bridge",
    "source_id": "c06",
    "title": "Horizon Bridge",
    "institution": "PARP",
    "announced_at": "2026-09-26",
    "opens_at": "2026-10-15",
    "closes_at": "2026-12-15",
    "budget_total": 5000000,
    "max_grant": 66000,
    "funding_percent": 100,
    "beneficiaries": "Mikro, małe i średnie przedsiębiorstwa",
    "scope": "Doradztwo przy przygotowaniu wniosków do Horyzontu Europa",
    "required_docs": [
      "Zaświadczenia ZUS i US (do 3 mies.)",
      "Zaświadczenie o niekaralności",
      "Oświadczenie małżonka (jeśli dotyczy)",
      "Formularz zgłoszeniowy i plan prac"
    ],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: karta). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/program-horizon-bridge",
    "attachments": [],
    "confidence": {
      "opens_at": 0.9,
      "closes_at": 0.9,
      "budget_total": 0.9,
      "max_grant": 0.9,
      "funding_percent": 0.9
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-edih",
    "source_id": "c06",
    "title": "Współfinansowanie działań EDIH",
    "institution": "PARP",
    "announced_at": "2026-09-24",
    "call_number": "FENG.02.22-IP.02-001/26",
    "opens_at": "2026-09-24",
    "closes_at": "2026-10-28",
    "budget_total": 20000000,
    "beneficiaries": "Koordynatorzy EDIH wybrani w konkursie KE",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: karta). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/wspolfinansowanie-dzialan-edih-1",
    "program": {
      "name": "FENG",
      "url": "https://www.funduszeeuropejskie.gov.pl/"
    },
    "attachments": [],
    "confidence": {
      "opens_at": 0.9,
      "closes_at": 0.9,
      "budget_total": 0.9
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-spark",
    "source_id": "c06",
    "title": "Spark 4.0 - edycja Rethink",
    "institution": "PARP",
    "announced_at": "2026-08-14",
    "opens_at": "2026-08-14",
    "closes_at": "2026-09-30",
    "max_grant": 350000,
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/lodzka-specjalna-strefa-ekonomiczna-lsse",
    "attachments": [],
    "confidence": {
      "opens_at": 0.8,
      "closes_at": 0.8,
      "max_grant": 0.8
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-startupsexchange",
    "source_id": "c06",
    "title": "StartupsExchange by StartSmart CEE",
    "institution": "PARP",
    "announced_at": "2026-09-23",
    "opens_at": "2026-09-23",
    "closes_at": "2026-10-30",
    "max_grant": 100000,
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/startupsexchange-by-startsmart-cee",
    "attachments": [],
    "confidence": {
      "opens_at": 0.8,
      "closes_at": 0.8,
      "max_grant": 0.8
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-garagegenius",
    "source_id": "c06",
    "title": "GarageGenius",
    "institution": "PARP",
    "announced_at": "2026-09-07",
    "opens_at": "2026-09-07",
    "closes_at": "2026-11-30",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/garagegenius",
    "attachments": [],
    "confidence": {
      "opens_at": 0.8,
      "closes_at": 0.8
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-platformy-iib",
    "source_id": "c06",
    "title": "Platformy startowe dla nowych pomysłów – komponent IIb",
    "institution": "PARP",
    "announced_at": "2026-09-26",
    "opens_at": "2026-10-06",
    "closes_at": "2026-12-10",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/platformy-startowe-dla-nowych-pomyslow-1-1-komponent-IIb",
    "attachments": [],
    "confidence": {
      "opens_at": 0.8,
      "closes_at": 0.8
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-klastry-kkk",
    "source_id": "c06",
    "title": "Rozwój oferty klastrów dla firm – Krajowe Klastry Kluczowe",
    "institution": "PARP",
    "announced_at": "2026-09-16",
    "opens_at": "2026-09-16",
    "closes_at": "2026-11-04",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.parp.gov.pl/component/grants/grants/rozwoj-oferty-klastrow-dla-firm-nabor-dla-koordynatorow-krajowych-klastrow-kluczowych",
    "attachments": [],
    "confidence": {
      "opens_at": 0.8,
      "closes_at": 0.8
    },
    "manual_overrides": {}
  },
  {
    "id": "parp-przepis-na-rozwoj",
    "source_id": "c06",
    "title": "Przepis na rozwój - czas na niskoemisyjną GOZpodarkę",
    "institution": "PARP",
    "announced_at": "2026-09-26",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony PARP 26.09.2026 (odczyt: lista). Przed decyzją sprawdź ogłoszenie u źródła. Uwaga: Harmonogram podaje tylko miesiąc – dokładne daty sprawdź w ogłoszeniu.",
    "source_url": "https://hrp.com.pl/projekty/przepis-na-rozwoj-czas-na-niskoemisyjna-gozpodarke/",
    "attachments": [],
    "confidence": {},
    "manual_overrides": {}
  },
  {
    "id": "ncbr-smart-konsorcja",
    "source_id": "c07",
    "title": "FENG.01.01 Ścieżka SMART – Projekty realizowane w konsorcjach",
    "institution": "NCBR",
    "announced_at": "2026-07-01",
    "opens_at": "2026-08-07",
    "closes_at": "2026-10-16",
    "budget_total": 350000000,
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony NCBR 26.09.2026 (odczyt: harmonogram). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.gov.pl/web/ncbr/harmonogram-konkursow-2026",
    "program": {
      "name": "FENG",
      "url": "https://www.funduszeeuropejskie.gov.pl/"
    },
    "attachments": [],
    "confidence": {
      "opens_at": 0.75,
      "closes_at": 0.75,
      "budget_total": 0.75
    },
    "manual_overrides": {}
  },
  {
    "id": "ncbr-agrostrateg-1",
    "source_id": "c07",
    "title": "AGROSTRATEG I",
    "institution": "NCBR",
    "announced_at": "2026-03-31",
    "opens_at": "2026-05-14",
    "closes_at": "2026-08-28",
    "budget_total": 300000000,
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony NCBR 26.09.2026 (odczyt: harmonogram). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.gov.pl/web/ncbr/harmonogram-konkursow-2026",
    "attachments": [],
    "confidence": {
      "opens_at": 0.75,
      "closes_at": 0.75,
      "budget_total": 0.75
    },
    "manual_overrides": {}
  },
  {
    "id": "nfos-1-12",
    "source_id": "c08",
    "title": "1.12 Efektywność energetyczna budynków mieszkalnych na obszarach wiejskich",
    "institution": "NFOŚiGW",
    "announced_at": "2026-09-09",
    "call_number": "26/NC/UR/1.12/2026",
    "opens_at": "2026-09-09",
    "closes_at": "2026-09-30",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony NFOŚiGW 26.09.2026 (odczyt: harmonogram). Przed decyzją sprawdź ogłoszenie u źródła. Uwaga: Nazwę programu potwierdź w ogłoszeniu.",
    "source_url": "https://www.gov.pl/web/nfosigw/harmonogram-naborow",
    "attachments": [],
    "confidence": {
      "opens_at": 0.75,
      "closes_at": 0.75
    },
    "manual_overrides": {}
  },
  {
    "id": "nfos-1-3",
    "source_id": "c08",
    "title": "1.3 OZE dla przemysłu energochłonnego",
    "institution": "NFOŚiGW",
    "announced_at": "2026-09-26",
    "opens_at": "2026-11-02",
    "closes_at": "2027-04-30",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony NFOŚiGW 26.09.2026 (odczyt: harmonogram). Przed decyzją sprawdź ogłoszenie u źródła. Uwaga: Nazwę programu potwierdź w ogłoszeniu.",
    "source_url": "https://www.gov.pl/web/nfosigw/harmonogram-naborow",
    "attachments": [],
    "confidence": {
      "opens_at": 0.75,
      "closes_at": 0.75
    },
    "manual_overrides": {}
  },
  {
    "id": "nfos-1-4",
    "source_id": "c08",
    "title": "1.4 Energia dla wsi",
    "institution": "NFOŚiGW",
    "announced_at": "2026-09-26",
    "opens_at": "2026-10-01",
    "closes_at": "2026-12-31",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony NFOŚiGW 26.09.2026 (odczyt: harmonogram). Przed decyzją sprawdź ogłoszenie u źródła.",
    "source_url": "https://www.gov.pl/web/nfosigw/harmonogram-naborow",
    "attachments": [],
    "confidence": {
      "opens_at": 0.75,
      "closes_at": 0.75
    },
    "manual_overrides": {}
  },
  {
    "id": "nfos-1-1",
    "source_id": "c08",
    "title": "1.1 Sieci ładowania pojazdów elektrycznych",
    "institution": "NFOŚiGW",
    "announced_at": "2026-09-26",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony NFOŚiGW 26.09.2026 (odczyt: harmonogram). Przed decyzją sprawdź ogłoszenie u źródła. Uwaga: Harmonogram podaje tylko kwartał – to zapowiedź bez dat.",
    "source_url": "https://www.gov.pl/web/nfosigw/harmonogram-naborow",
    "attachments": [],
    "confidence": {},
    "manual_overrides": {}
  },
  {
    "id": "atlas-lgr-mazury",
    "source_id": "c10",
    "title": "3.1 Realizacja lokalnych strategii rozwoju i współpraca (LGR Mazury, Cel 1)",
    "institution": "Lokalna Grupa Rybacka Mazury",
    "announced_at": "2026-09-14",
    "opens_at": "2026-09-14",
    "closes_at": "2026-09-29",
    "beneficiaries": "Nie odczytano – sprawdź w ogłoszeniu.",
    "scope": "Nie odczytano – sprawdź w ogłoszeniu.",
    "required_docs": [],
    "summary_ai": "Dane odczytane automatycznie ze strony Atlas Dotacji 26.09.2026 (odczyt: karta). Przed decyzją sprawdź ogłoszenie u źródła. Uwaga: Informacja z agregatora – oficjalne ogłoszenie: https://www.funduszeunijne.gov.pl/nabory/31-realizacja-lokalnych-strategii-rozwoju-i-wspolpraca-69/",
    "source_url": "https://atlasdotacji.pl/nabory/fe-da70738fe7bd",
    "program": {
      "name": "Fundusze Europejskie dla Rybactwa 2021–2027",
      "url": "https://www.funduszeeuropejskie.gov.pl/"
    },
    "attachments": [],
    "confidence": {
      "opens_at": 0.9,
      "closes_at": 0.9
    },
    "manual_overrides": {}
  }
]
