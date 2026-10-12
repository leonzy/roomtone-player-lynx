import { useEffect, useRef, useState } from '@lynx-js/react'
import { useTranslation } from 'react-i18next'
import { Input } from '@lynx-js/lynx-ui-input'

import { openURL } from '../../../native/native-platform.js'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog.js'

interface TokenDialogProps {
  show: boolean
  ready: boolean
  configured: boolean
  loadFailed: boolean
  onRetry: () => void
  onSave: (token: string) => Promise<void>
  onClose: () => void
}

export function GithubDiscoveryTokenDialog({ show, ready, configured, loadFailed, onRetry, onSave, onClose }: TokenDialogProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [hidden, setHidden] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    generation.current++
    if (!show) { setDraft(''); setHidden(true); setError(''); setSaving(false) }
    return () => { generation.current++ }
  }, [show])
  const save = async (token: string) => {
    'background only'
    if (!ready || inFlight.current) return
    inFlight.current = true
    const current = generation.current
    setSaving(true)
    setError('')
    try {
      await onSave(token)
      if (generation.current === current) onClose()
    } catch {
      if (generation.current === current) setError(t('githubDiscovery.tokenSaveFailed'))
    } finally {
      inFlight.current = false
      if (generation.current === current) setSaving(false)
    }
  }
  return (
    <ConfirmDialog show={show} title={t('githubDiscovery.tokenTitle')} message={t('githubDiscovery.tokenHelp')}
      confirmLabel={saving ? t('common.loading') : t('githubDiscovery.tokenSave')}
      onConfirm={() => { if (draft.trim()) void save(draft.trim()) }} onCancel={onClose}
      testId='github-token-dialog' confirmTestId='github-token-save' cancelTestId='github-token-cancel'>
      <text className='github-discovery__meta'>{ready ? t(configured ? 'githubDiscovery.tokenConfigured' : 'githubDiscovery.tokenNotConfigured') : t(loadFailed ? 'githubDiscovery.tokenLoadFailed' : 'common.loading')}</text>
      {loadFailed ? <view bindtap={onRetry} data-testid='github-token-retry'><text className='plugin-registry__retry-text'>{t('common.retry')}</text></view> : null}
      <view className='plugin-registry__search'>
        <Input id='github-token-input' className='plugin-registry__search-input' type={hidden ? 'password' : 'text'}
          value={draft} onInput={setDraft} maxLength={512} readonly={!ready || saving} placeholder={t('githubDiscovery.tokenHint')} />
      </view>
      <view className='github-discovery__links'>
        <view bindtap={() => setHidden(value => !value)} data-testid='github-token-visibility'><text className='plugin-registry__retry-text'>{t('githubDiscovery.tokenVisibility')}</text></view>
        <view bindtap={() => { try { openURL('https://github.com/settings/tokens') } catch { setError(t('githubDiscovery.openFailed')) } }} data-testid='github-token-create'><text className='plugin-registry__retry-text'>{t('githubDiscovery.tokenCreate')}</text></view>
        {configured ? <view bindtap={() => { void save('') }} data-testid='github-token-clear'><text className='plugin-registry__retry-text'>{t('githubDiscovery.tokenClear')}</text></view> : null}
      </view>
      {error ? <text className='github-discovery__notice-text'>{error}</text> : null}
    </ConfirmDialog>
  )
}
