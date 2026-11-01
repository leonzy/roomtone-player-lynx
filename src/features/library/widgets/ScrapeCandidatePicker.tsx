import { useState } from '@lynx-js/react'
import { useTranslation } from 'react-i18next'
import type { ScrapeResult } from '../api/manual-scrape-api.js'

export function scrapeSourceName(source: string) {
  return ({ acoustid: 'AcoustID', qqmusic: 'QQ音乐', netease: '网易云', migu: '咪咕', kugou: '酷狗', kuwo: '酷我' } as Record<string, string>)[source] ?? source
}
export const scrapeScorePercent = (score: number) => Math.round(score * 1000) / 10

export function ScrapeCandidatePicker({ result, selected, disabled, onSelect }: { result: ScrapeResult; selected: ScrapeResult | null; disabled: boolean; onSelect(candidate: ScrapeResult | null): void }) {
  const { t } = useTranslation()
  const [source, setSource] = useState(selected?.source ?? result.source)
  const candidates = [...(result.candidates ?? [result])].sort((a, b) => b.score - a.score)
  const sources = [...new Set([...Object.keys(result.source_diagnostics ?? {}), ...candidates.map(c => c.source)])]
  const rows = candidates.filter(c => c.source === source)
  const pick = (candidate: ScrapeResult | null) => onSelect(candidate && { ...candidate, score_threshold: result.score_threshold, below_threshold: candidate.score < (result.score_threshold ?? 0.7) })
  return <view className='scrape-candidates' data-testid='scrape-candidates'>
    <text className='song-info-scrape__hint'>{t('manualScrape.chooseSource')}</text>
    <view className='scrape-candidates__sources'>{sources.map(s => <view key={s} className={`scrape-candidates__source${s === source ? ' scrape-candidates__source--selected' : ''}`} data-testid={`scrape-source-${s}`} bindtap={disabled ? undefined : () => { setSource(s); pick(candidates.find(c => c.source === s) ?? null) }} accessibility-element={true} accessibility-traits='button' accessibility-label={scrapeSourceName(s)}><text>{scrapeSourceName(s)} · {candidates.filter(c => c.source === s).length}</text></view>)}</view>
    {!rows.length && <text className='song-info-scrape__hint' data-testid='scrape-source-empty'>{result.source_diagnostics?.[source]?.error || t('manualScrape.noCandidates')}</text>}
    {rows.map((candidate, i) => {
      const checked = selected?.source === candidate.source && selected.artist === candidate.artist && selected.title === candidate.title && selected.album === candidate.album
      return <view key={i} className={`scrape-candidates__row${checked ? ' scrape-candidates__row--selected' : ''}`} data-testid={`scrape-candidate-${source}-${i}`} bindtap={disabled ? undefined : () => pick(candidate)} accessibility-element={true} accessibility-traits='button' accessibility-label={`${candidate.title}, ${candidate.artist}`}>
        <text className='scrape-candidates__check'>{checked ? '●' : '○'}</text><view className='scrape-candidates__copy'><text className='scrape-candidates__title'>{candidate.title}</text><text className='song-info-scrape__hint'>{[candidate.artist, candidate.album].filter(Boolean).join(' · ')}</text><text className='song-info-scrape__hint'>{t(candidate.score_kind === 'fingerprint' || source === 'acoustid' ? 'manualScrape.fingerprintScore' : 'manualScrape.textScore', { score: scrapeScorePercent(candidate.score) })}</text>{candidate.fingerprint_conflict && <text className='scrape-candidates__conflict'>{t('manualScrape.conflictBadge')}</text>}</view>
      </view>
    })}
  </view>
}
