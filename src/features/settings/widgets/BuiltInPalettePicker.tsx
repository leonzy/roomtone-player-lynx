import { useEffect, useState } from '@lynx-js/react'
import { useTranslation } from 'react-i18next'

import {
  BUILT_IN_PALETTES, BUILT_IN_PALETTE_OPTIONS, changeBuiltInPalette,
  getBuiltInPalette, subscribeBuiltInPalette,
} from '../../../shared/theme/built-in-palette-model.js'
import { getActiveThemePack, subscribeActiveThemePack } from '../../../shared/theme/theme-pack-model.js'
import { useSurfaceAppearance } from '../../../shared/theme/surface-appearance.js'
import { foregroundOn } from '../../../shared/theme/color-contrast.js'
import { Icon } from '../../../shared/ui/Icon.js'
import { SettingsSection } from './SettingsSection.js'
import './BuiltInPalettePicker.css'

export function BuiltInPalettePicker() {
  const { t } = useTranslation()
  const { theme } = useSurfaceAppearance()
  const [selected, setSelected] = useState(getBuiltInPalette)
  const [pack, setPack] = useState(getActiveThemePack)
  const labels = {
    blue: t('settings.builtInPalette.blue'), teal: t('settings.builtInPalette.teal'),
    forest: t('settings.builtInPalette.forest'), rose: t('settings.builtInPalette.rose'),
    amber: t('settings.builtInPalette.amber'), violet: t('settings.builtInPalette.violet'),
  }
  useEffect(() => {
    const updatePalette = () => setSelected(getBuiltInPalette())
    const updatePack = () => setPack(getActiveThemePack())
    const stops = [subscribeBuiltInPalette(updatePalette), subscribeActiveThemePack(updatePack)]
    updatePalette()
    updatePack()
    return () => stops.forEach(stop => stop())
  }, [])

  return (
    <SettingsSection title={t('settings.builtInPaletteTitle')}>
      <view className='palette-picker'>
        <text className='palette-picker__description'>
          {t(pack ? 'settings.builtInPalettePackHint' : 'settings.builtInPaletteDescription')}
        </text>
        <view className='palette-picker__choices'>
          {BUILT_IN_PALETTE_OPTIONS.map(palette => {
            const active = !pack && palette === selected
            const color = BUILT_IN_PALETTES[palette][theme]
            return (
              <view
                key={palette}
                className={`palette-choice${active ? ' palette-choice--selected' : ''}${pack ? ' palette-choice--disabled' : ''}`}
                data-testid={`palette-${palette}`}
                accessibility-element={true}
                accessibility-label={labels[palette]}
                accessibility-traits={active ? 'selected' : 'button'}
                bindtap={pack ? undefined : () => { void changeBuiltInPalette(palette) }}
              >
                <view className='palette-choice__swatch' style={{ backgroundColor: color }}>
                  {active ? <Icon name='check' size={14} color={foregroundOn(color)} /> : null}
                </view>
                <text className='palette-choice__label'>{labels[palette]}</text>
              </view>
            )
          })}
        </view>
      </view>
    </SettingsSection>
  )
}
