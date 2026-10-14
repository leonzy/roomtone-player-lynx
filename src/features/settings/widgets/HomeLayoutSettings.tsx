import { useTranslation } from 'react-i18next'
import { changeHomeConfig, useHomeConfig } from '../../home/data/home-layout.js'
import { HOME_COLUMNS, HOME_MAX_ITEMS, HOME_ROWS, type HomeLayout } from '../../home/domain/home-layout.js'
import { SettingsSection } from './SettingsSection.js'
import { SwitchRow } from './SwitchRow.js'
import './HomeLayoutSettings.css'

export function HomeLayoutSettings() {
  const { t } = useTranslation()
  const config = useHomeConfig()
  const layouts: { value: HomeLayout; label: string }[] = [
    { value: 'adaptive', label: t('home.layoutAdaptive') },
    { value: 'carousel', label: t('home.layoutCarousel') },
    { value: 'grid', label: t('home.layoutGrid') },
    { value: 'list', label: t('home.layoutList') },
  ]
  return <SettingsSection title={t('home.layoutTitle')}>
    <SwitchRow title={t('home.showRadios')} subtitle={t('home.showRadiosDesc')}
      checked={config.showRadios} onChange={showRadios => { void changeHomeConfig({ showRadios }) }}
      testId='home-show-radios' />
    <view className='settings-section__padded'>
      <view className='home-layout-options'>
        {layouts.map(({ value, label }) => <view key={value}
          className={`home-layout-option${config.layout === value ? ' home-layout-option--selected' : ''}`}
          bindtap={() => { void changeHomeConfig({ layout: value }) }}
          data-testid={`home-layout-${value}`}><text className='home-layout-option__text'>{label}</text></view>)}
      </view>
      <text className='home-layout-label'>{t('home.gridColumns')}</text>
      <view className='home-layout-options'>
        {HOME_COLUMNS.map(value => <view key={String(value)}
          className={`home-layout-option${config.columns === value ? ' home-layout-option--selected' : ''}`}
          bindtap={() => { void changeHomeConfig({ columns: value }) }}
          data-testid={`home-columns-${value}`}><text className='home-layout-option__text'>{value === 0 ? t('home.gridAuto') : String(value)}</text></view>)}
      </view>
      <text className='home-layout-label'>{t('home.gridRows')}</text>
      <view className='home-layout-options'>
        {HOME_ROWS.map(value => <view key={String(value)}
          className={`home-layout-option${config.rows === value ? ' home-layout-option--selected' : ''}`}
          bindtap={() => { void changeHomeConfig({ rows: value }) }}
          data-testid={`home-rows-${value}`}><text className='home-layout-option__text'>{value === 0 ? t('home.gridAll') : String(value)}</text></view>)}
      </view>
      <text className='home-layout-hint'>{t('home.gridHint', { count: HOME_MAX_ITEMS })}</text>
    </view>
  </SettingsSection>
}
