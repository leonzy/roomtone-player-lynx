export type UpgradeChannel = 'stable' | 'dev'

export interface UpgradeCheck {
  hasUpdate: boolean
  isDocker: boolean
  currentVersion: string
  channel: UpgradeChannel
  latestVersion: string
  changelog?: string
}

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Online upgrades stay on the running backend's channel, as enforced by the server. */
export function parseUpgradeCheck(value: unknown): UpgradeCheck {
  const data = record(value)
  const current = record(data.current)
  const currentVersion = text(data.current_version) || text(current.version)
  const declaredChannel = text(data.current_channel) || text(current.channel)
  const channel: UpgradeChannel =
    declaredChannel === 'dev' ||
    (declaredChannel !== 'stable' && currentVersion.trim().toLowerCase() === 'dev')
      ? 'dev'
      : 'stable'
  // When present, the channel map is authoritative; never use another channel's
  // flattened version/notes to offer an update on the running channel.
  const hasChannelMap = data.updates != null && typeof data.updates === 'object'
  const update = record(record(data.updates)[channel])
  const latestVersion = hasChannelMap ? text(update.version) : text(data.latest_version)
  return {
    hasUpdate: data.has_update === true && latestVersion !== '',
    isDocker: data.is_docker === true,
    currentVersion,
    channel,
    latestVersion,
    changelog:
      (hasChannelMap
        ? text(update.release_notes)
        : text(data.release_notes) || text(data.changelog)) || undefined,
  }
}
