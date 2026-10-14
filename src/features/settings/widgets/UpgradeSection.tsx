import { useEffect, useRef, useState } from '@lynx-js/react'
import { useTranslation } from 'react-i18next'

import type { UpgradeCheck } from '../domain/upgrade-model.js'
import { Icon, ICON_COLORS } from '../../../shared/ui/Icon.js'
import { Markdown } from '../../../shared/ui/Markdown.js'
import { getSettingsApi } from '../api/index.js'
import './UpgradeSection.css'

interface UpgradeProgress {
  status: 'idle' | 'downloading' | 'testing' | 'replacing' | 'restarting' | 'completed' | 'failed'
  progress: number
  currentStep: string
  error?: string
}

async function getProgress(): Promise<UpgradeProgress> {
  const data = await getSettingsApi().getUpgradeProgress()
  return {
    status: (data.status as UpgradeProgress['status']) ?? 'idle',
    progress: Number(data.progress ?? 0),
    currentStep: String(data.current_step ?? ''),
    error: data.error ? String(data.error) : undefined,
  }
}

const POLL_INTERVAL_MS = 2000
/** ~30s of consecutive failures — long enough for a real backend restart. */
const MAX_POLL_FAILURES = 15

/**
 * Backend update check / start / progress, rendered as a section **inside** the
 * About page rather than its own route. The page chrome (topbar / back / title /
 * scroll) comes from `AboutPage`'s `SubPageShell`; this widget owns only the
 * upgrade UI and the polling loop. Online upgrades follow the backend's current
 * channel and are available only for Docker deployments.
 */
export function UpgradeSection() {
  const { t } = useTranslation()

  const [checking, setChecking] = useState(true)
  const [checkResult, setCheckResult] = useState<UpgradeCheck | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [progress, setProgress] = useState<UpgradeProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startPending = useRef(false)

  useEffect(() => {
    void getSettingsApi()
      .checkUpgrade()
      .then(setCheckResult)
      .catch(e => setError(String(e instanceof Error ? e.message : e)))
      .finally(() => setChecking(false))
  }, [])

  /**
   * Poll the backend's own upgrade progress.
   *
   * The request is expected to fail for a while: `replacing`/`restarting` means
   * the server we are polling is being replaced under us. So failures cannot be
   * fatal — but they cannot be ignored either. Previously this was a bare
   * `void getProgress().then(…)`: on a backend that never came back, every tick
   * raised an unhandled rejection, `upgrading` stayed true forever, and the UI
   * sat on the last known percentage with no conclusion. Tolerate a restart-sized
   * outage, then give up with an actionable message.
   */
  useEffect(() => {
    if (!upgrading) return
    let failures = 0
    const timer = setInterval(() => {
      if (startPending.current) return
      void getProgress()
        .then(p => {
          failures = 0
          setProgress(p)
          if (p.status === 'completed' || p.status === 'failed') {
            setUpgrading(false)
          }
        })
        .catch(() => {
          failures += 1
          if (failures >= MAX_POLL_FAILURES) {
            setUpgrading(false)
            setError(t('upgrade.progressLost'))
          }
        })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [upgrading, t])

  const onStartUpgrade = () => {
    if (!checkResult?.isDocker || !checkResult.hasUpdate || upgrading || startPending.current)
      return
    startPending.current = true
    setError(null)
    setUpgrading(true)
    setProgress({ status: 'downloading', progress: 0, currentStep: '' })
    void getSettingsApi()
      .startUpgrade(checkResult.channel)
      .catch(e => {
        setError(String(e instanceof Error ? e.message : e))
        setUpgrading(false)
      })
      .finally(() => {
        startPending.current = false
      })
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      idle: t('upgrade.idle'),
      downloading: t('upgrade.downloading'),
      testing: t('upgrade.testing'),
      replacing: t('upgrade.replacing'),
      restarting: t('upgrade.restarting'),
      completed: t('upgrade.completed'),
      failed: t('upgrade.failed'),
    }
    return map[status] ?? status
  }

  return (
    <>
      {checking ? (
        <text className='upgrade-page__state'>{t('upgrade.checking')}</text>
      ) : error && !checkResult ? (
        <text className='upgrade-page__state upgrade-page__state--error'>{error}</text>
      ) : checkResult && !checkResult.isDocker ? (
        <text className='upgrade-page__state'>{t('upgrade.dockerOnly')}</text>
      ) : checkResult && !checkResult.hasUpdate && !upgrading ? (
        <view className='upgrade-page__section'>
          <Icon name='check-circle' size={40} color={ICON_COLORS.primary} />
          <text className='upgrade-page__up-to-date'>{t('upgrade.upToDate')}</text>
          <text className='upgrade-page__version'>{checkResult.currentVersion}</text>
        </view>
      ) : checkResult && checkResult.hasUpdate && !upgrading ? (
        <view className='upgrade-page__section'>
          <text className='upgrade-page__new-version'>
            {t('upgrade.newVersion', { version: checkResult.latestVersion })}
          </text>
          <text className='upgrade-page__current'>
            {t('upgrade.current', { version: checkResult.currentVersion })}
          </text>
          {checkResult.changelog ? (
            <Markdown className='upgrade-page__changelog' content={checkResult.changelog} />
          ) : null}
          <view className='upgrade-page__btn' bindtap={onStartUpgrade} data-testid='upgrade-start'>
            <text className='upgrade-page__btn-text'>{t('upgrade.start')}</text>
          </view>
        </view>
      ) : null}

      {upgrading && progress ? (
        <view className='upgrade-page__progress'>
          <text className='upgrade-page__progress-status'>{statusLabel(progress.status)}</text>
          <view className='upgrade-page__progress-bar'>
            <view className='upgrade-page__progress-fill' style={`width: ${progress.progress}%`} />
          </view>
          <text className='upgrade-page__progress-step'>{progress.currentStep}</text>
          <text className='upgrade-page__progress-pct'>{progress.progress}%</text>
        </view>
      ) : null}

      {/*
        Errors raised *after* a successful version check need their own slot:
        the branch above only renders `error` when `!checkResult`, so both the
        "start upgrade failed" and "lost contact while polling" messages were
        set into state and then never shown to anyone.
      */}
      {error && checkResult ? (
        <text className='upgrade-page__state upgrade-page__state--error'>{error}</text>
      ) : null}

      {progress?.status === 'completed' ? (
        <view className='upgrade-page__section'>
          <Icon name='check-circle' size={40} color={ICON_COLORS.primary} />
          <text className='upgrade-page__up-to-date'>{t('upgrade.completed')}</text>
        </view>
      ) : null}

      {progress?.status === 'failed' ? (
        <view className='upgrade-page__section'>
          <Icon name='warning' size={40} color={ICON_COLORS.danger} />
          <text className='upgrade-page__state upgrade-page__state--error'>
            {progress.error || t('upgrade.failed')}
          </text>
        </view>
      ) : null}
    </>
  )
}
