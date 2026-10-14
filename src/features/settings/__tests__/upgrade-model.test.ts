import { expect, test } from 'vitest'

import { parseUpgradeCheck } from '../domain/upgrade-model.js'

test.each(['stable', 'dev'])(
  'legacy flat responses infer the %s channel from the running version',
  channel => {
    expect(
      parseUpgradeCheck({
        has_update: true,
        is_docker: true,
        current_version: channel === 'dev' ? 'dev' : '3.0.0',
        latest_version: channel === 'dev' ? 'dev' : '3.0.1',
        release_notes: 'Actual backend notes',
        changelog: 'Legacy notes',
      }),
    ).toMatchObject({
      channel,
      hasUpdate: true,
      isDocker: true,
      changelog: 'Actual backend notes',
    })
  },
)

test('nested current fields select only the current channel, ignoring the flat stable summary', () => {
  expect(
    parseUpgradeCheck({
      has_update: true,
      is_docker: true,
      current: { version: 'dev', channel: 'dev' },
      latest_version: '3.0.1',
      release_notes: 'Stable summary',
      updates: {
        stable: { version: '3.0.1', release_notes: 'Stable notes' },
        dev: { version: 'dev', release_notes: 'Dev notes' },
      },
    }),
  ).toEqual({
    hasUpdate: true,
    isDocker: true,
    currentVersion: 'dev',
    channel: 'dev',
    latestVersion: 'dev',
    changelog: 'Dev notes',
  })
})

test.each([{}, { stable: { version: '3.0.1' } }, { dev: { error: 'Unavailable' } }])(
  'a channel map without a usable current-channel update cannot offer the flattened release',
  updates => {
    expect(
      parseUpgradeCheck({
        has_update: true,
        is_docker: true,
        current_version: 'dev',
        latest_version: '3.0.1',
        updates,
      }).hasUpdate,
    ).toBe(false)
  },
)

test.each([undefined, null, [], {}, { has_update: 'false', is_docker: 'true' }])(
  'missing or malformed responses never enable an online upgrade',
  response => {
    expect(parseUpgradeCheck(response)).toMatchObject({
      hasUpdate: false,
      isDocker: false,
    })
  },
)
