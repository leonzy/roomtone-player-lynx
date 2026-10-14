import { useState } from '@lynx-js/react'
import { useTranslation } from 'react-i18next'
import { Icon, ICON_COLORS } from '../../../shared/ui/Icon.js'
import { PopoverMenu } from '../../../shared/ui/PopoverMenu.js'
import { changeHomeConfig, useHomeConfig } from '../data/home-layout.js'
import type { HomeLayout } from '../domain/home-layout.js'

export function HomeLayoutMenu() {
  const { t } = useTranslation()
  const config = useHomeConfig()
  const [show, setShow] = useState(false)
  return <PopoverMenu show={show} onShowChange={setShow}
    trigger={<Icon name='grid' size={20} color={ICON_COLORS.contentMuted} />}
    triggerClassName='home-section__action'
    items={[
      { key: 'adaptive', label: t('home.layoutAdaptive'), selected: config.layout === 'adaptive' },
      { key: 'carousel', label: t('home.layoutCarousel'), selected: config.layout === 'carousel' },
      { key: 'grid', label: t('home.layoutGrid'), selected: config.layout === 'grid' },
      { key: 'list', label: t('home.layoutList'), selected: config.layout === 'list' },
    ]}
    onSelect={key => { void changeHomeConfig({ layout: key as HomeLayout }) }} />
}
