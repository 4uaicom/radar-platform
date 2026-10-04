import type { Grant } from '../types'
import { parseDate } from './rules'
import { datePair, makeGrant, stillOpen, text } from './common'

export const FESL_URL = 'https://funduszeue.slaskie.pl/nabory/lsi'
const P = '_pl_slaskie_fes_RecruitmentPortlet_'
/** Lista z filtrem „Trwa nabór” + „Planowany” (lista bez filtra jest posortowana po dacie publikacji i gubi długie nabory). */
export const FESL_OPEN_URL =
  `https://funduszeue.slaskie.pl/web/guest/nabory?p_p_id=pl_slaskie_fes_RecruitmentPortlet&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&${P}mvcRenderCommandName=%2Frecruitment%2Flist` +
  `&${P}statusFilter=RECRUITMENT_STATUS_ONGOING&${P}statusFilter=RECRUITMENT_STATUS_PLANNED`
/** Kolejne strony listy (10 naborów na stronę, najnowsze na górze). */
export const feslPageUrl = (page: number) =>
  page <= 1
    ? FESL_URL
    : `https://funduszeue.slaskie.pl/web/guest/nabory?p_p_id=pl_slaskie_fes_RecruitmentPortlet&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_pl_slaskie_fes_RecruitmentPortlet_mvcRenderCommandName=%2Frecruitment%2Flist&_pl_slaskie_fes_RecruitmentPortlet_page=${page}`

/**
 * Lista naborów FE SL: każdy nabór to <section class="recruitment-wrapper"> z instytucją, datą publikacji,
 * statusem, numerem naboru, poziomem dofinansowania i datami Start/Koniec.
 */
export function parseFesl(html: string, today: Date, source_id = 'c04'): Grant[] {
  const out: Grant[] = []
  const sections = html.split('<section class="recruitment-wrapper">').slice(1)
  for (const s of sections) {
    const link = s.match(/<a href="([^"]*\/nabory\/lsi\/(\d+))"\s*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/)
    if (!link) continue
    const lsiId = link[2]
    const h3 = link[3]
    const call = text(h3.match(/Nabór nr\s*([^<]+)/)?.[1]) || undefined
    const name = text(h3.split(/<br\s*\/?>/i).slice(1).join(' ')) || text(h3)
    const who = s.match(/whoWhat--who">([\s\S]*?)<\/span>/)?.[1]
    const published = parseDate(s.match(/header__dateTime[^>]*>\s*([\d.]+)/)?.[1])
    const status = text(s.match(/feux-label-tag__[\w-]+__active[^>]*>([\s\S]*?)<\/div>/)?.[1])
    const action = text(s.match(/feux-label-tag__dark-blue__active[^>]*>([\s\S]*?)<\/div>/)?.[1])
    const mode = text(s.match(/recruitment-wrapper__descBar[^>]*>([\s\S]*?)<\/div>/)?.[1])
    const percent = s.match(/financeBar__info__range">\s*(\d+(?:[.,]\d+)?)/)?.[1]
    const dateMap: Record<string, string> = {}
    for (const d of s.matchAll(/dateBar_title">\s*(Start|Koniec)\s*<\/span>\s*<span class="recruitment-wrapper__dateBar_date">\s*([^<]+?)\s*</g)) dateMap[d[1]] = d[2]
    out.push(
      makeGrant(
        {
          id: `fesl-${lsiId}`,
          source_id,
          sourceName: 'FE SL 2021-2027 – lista naborów',
          title: name,
          institution: text(who) || 'FE SL 2021-2027',
          call_number: call,
          source_url: `https://funduszeue.slaskie.pl/nabory/lsi/${lsiId}/`,
          dates: datePair(dateMap.Start, dateMap.Koniec),
          announced: published.value ?? undefined,
          funding_percent: percent ? parseFloat(percent.replace(',', '.')) : undefined,
          program: { name: `Fundusze Europejskie dla Śląskiego 2021-2027${action ? `, działanie ${action}` : ''}`, url: FESL_URL },
          notes: [status && `Status na portalu: ${status}`, mode].filter(Boolean) as string[],
        },
        today,
      ),
    )
  }
  return out.filter((g) => stillOpen(g, today))
}
