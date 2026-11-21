import { useEffect, useMemo, useState } from '@lynx-js/react'
import { useTranslation } from 'react-i18next'

import { appConfig } from '../../../core/config/app-config.js'
import { copyToClipboard } from '../../../native/native-platform.js'
import { AppSwitch } from '../../../shared/ui/AppSwitch.js'
import { toast } from '../../../shared/ui/toast-store.js'
import { getSettingsApi } from '../api/index.js'
import type { MCPSettings } from '../api/settings-api.js'
import { SettingsSection } from '../widgets/SettingsSection.js'
import { SubPageShell } from '../widgets/SubPageShell.js'
import './MCPSettingsPage.css'

const MCP_SCOPES = ['read', 'playback', 'speakers', 'metadata', 'automation']

export function MCPSettingsPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<MCPSettings | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSettingsApi().getMCPSettings().then(setData).catch(() => toast.error(t('mcp.loadFailed')))
  }, [t])

  const configText = useMemo(() => {
    if (data == null) return ''
    return JSON.stringify({
      mcpServers: {
        roomtone: {
          url: `${appConfig.baseUrl.replace(/\/$/, '')}${data.endpoint}`,
          headers: { Authorization: `Bearer ${data.token}` },
        },
      },
    }, null, 2)
  }, [data])

  const update = async (update: { enabled?: boolean; scopes?: string[]; regenerateToken?: boolean }) => {
    if (data == null || busy || data.managedByEnvironment) return
    setBusy(true)
    try {
      setData(await getSettingsApi().updateMCPSettings(update))
      toast.success(t('mcp.saved'))
    } catch {
      toast.error(t('mcp.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const copyConfig = async () => {
    try {
      await copyToClipboard(configText)
      toast.success(t('common.copied'))
    } catch {
      toast.error(t('common.copyFailed'))
    }
  }

  return (
    <SubPageShell grouped title={t('mcp.title')} backTestId='mcp-back' scrollMemoryKey='mcp-settings'>
      {data == null
        ? <view className='mcp-settings__status'><text>{t('common.loading')}</text></view>
        : (
          <view>
            {data.managedByEnvironment
              ? <view className='mcp-settings__notice'><text>{t('mcp.environmentManaged')}</text></view>
              : null}
            <SettingsSection title={t('mcp.enable')} subtitle={t('mcp.enableSubtitle')}>
              <view className='mcp-settings__row'>
                <text className='mcp-settings__label'>{t('mcp.enabled')}</text>
                <AppSwitch
                  checked={data.enabled}
                  disabled={busy || data.managedByEnvironment}
                  onChange={(enabled) => { void update({ enabled }) }}
                />
              </view>
            </SettingsSection>

            <SettingsSection title={t('mcp.permissions')} subtitle={t('mcp.permissionsSubtitle')}>
              {MCP_SCOPES.map((scope) => (
                <view className='mcp-settings__row' key={scope}>
                  <text className='mcp-settings__label'>{scope}</text>
                  <AppSwitch
                    checked={data.scopes.includes(scope)}
                    disabled={busy || data.managedByEnvironment}
                    onChange={(checked) => {
                      const scopes = checked
                        ? [...data.scopes, scope]
                        : data.scopes.filter(item => item !== scope)
                      void update({ scopes })
                    }}
                  />
                </view>
              ))}
            </SettingsSection>

            <SettingsSection title={t('mcp.agentConfig')} subtitle={t('mcp.agentConfigSubtitle')}>
              <view className='mcp-settings__endpoint'><text>{t('mcp.endpoint')}: {appConfig.baseUrl.replace(/\/$/, '')}{data.endpoint}</text></view>
              <view className='mcp-settings__config'><text>{configText}</text></view>
              <view className='mcp-settings__actions'>
                <view className='mcp-settings__button' bindtap={copyConfig} data-testid='mcp-copy-config'>
                  <text className='mcp-settings__button-text'>{t('mcp.copyConfig')}</text>
                </view>
                <view
                  className={data.managedByEnvironment ? 'mcp-settings__button mcp-settings__button--disabled' : 'mcp-settings__button'}
                  bindtap={() => { void update({ regenerateToken: true }) }}
                  data-testid='mcp-regenerate-token'
                >
                  <text className='mcp-settings__button-text'>{t('mcp.regenerateToken')}</text>
                </view>
              </view>
              <text className='mcp-settings__hint'>{t('mcp.tokenHint')}</text>
            </SettingsSection>
          </view>
        )}
    </SubPageShell>
  )
}
