/**
 * Oficjalne strony programów (zamiast strony harmonogramu), sprawdzone 27.09.2026.
 * Nabór pokazuje link „Strona programu” – tu trafia użytkownik.
 */
const EU_LIST = 'https://commission.europa.eu/funding-and-tenders/find-funding/eu-funding-programmes_en'

const RULES: [RegExp, string][] = [
  [/FENG|Nowoczesnej Gospodarki/i, 'https://nowoczesnagospodarka.gov.pl/'],
  [/FERS|Rozwoju Społecznego/i, 'https://rozwojspoleczny.gov.pl/'],
  [/FEPW|Polski Wschodniej/i, 'https://polskawschodnia.gov.pl/'],
  [/FEnIKS|FENX|Infrastruktur[eę],? Klimat/i, 'https://feniks.gov.pl/'],
  [/Śląskiego|FE ?SL\b|FESL/i, 'https://funduszeue.slaskie.pl/'],
  [/Rybactw/i, 'https://rybactwo.gov.pl/'],
  [/\(HORIZON\)|Horyzont Europa/i, 'https://commission.europa.eu/funding-and-tenders/find-funding/eu-funding-programmes/horizon-europe_en'],
  [/\(DIGITAL\)|Cyfrowa Europa/i, 'https://commission.europa.eu/funding-and-tenders/find-funding/eu-funding-programmes/digital-europe-programme_en'],
  [/\(CEF\)|Łącząc Europę/i, 'https://commission.europa.eu/funding-tenders/find-funding/eu-funding-programmes/connecting-europe-facility_en'],
  [/^Program UE:/i, EU_LIST],
]

export function programLink(name: string | undefined): string | undefined {
  if (!name) return undefined
  return RULES.find(([re]) => re.test(name))?.[1]
}

/** Pełne nazwy programów UE z przedrostka identyfikatora tematu KE (np. DIGITAL-2026-… → Cyfrowa Europa). */
const EU_NAMES: Record<string, string> = {
  HORIZON: 'Horyzont Europa (HORIZON)',
  DIGITAL: 'Cyfrowa Europa (DIGITAL)',
  CEF: 'Instrument „Łącząc Europę” (CEF)',
  LIFE: 'LIFE – środowisko i klimat',
  ERASMUS: 'Erasmus+',
  EU4H: 'EU4Health – zdrowie',
  SMP: 'Program Jednolitego Rynku (SMP)',
  CERV: 'Obywatele, Równość, Prawa i Wartości (CERV)',
  CREA: 'Kreatywna Europa (CREA)',
  EDF: 'Europejski Fundusz Obronny (EDF)',
  EMFAF: 'Europejski Fundusz Morski, Rybacki i Akwakultury (EMFAF)',
  ESC: 'Europejski Korpus Solidarności (ESC)',
  I3: 'Instrument I3 – inwestycje międzyregionalne',
  RFCS: 'Fundusz Badawczy Węgla i Stali (RFCS)',
  SOCPL: 'Program Polityki Społecznej UE',
}

export function euProgrammeName(identifier: string): string {
  const code = identifier.split('-')[0].toUpperCase()
  return `Program UE: ${EU_NAMES[code] ?? code}`
}
