import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

test('default HTTP hosting does not depend on synchronous shared-memory RPC endpoints', () => {
  const source = readFileSync(join(root, 'node_modules/@lynx-js/web-core/dist/client/endpoints.js'), 'utf8')
  const endpoints = [...source.matchAll(/createRpcEndpoint\(\s*(['"])([^'"]+)\1,\s*(true|false)/g)]
  assert.ok(endpoints.length > 0, 'Endpoint audit must inspect the installed engine')
  assert.equal(endpoints.length, (source.match(/createRpcEndpoint\s*\(/g) ?? []).length,
    'Every endpoint declaration must be included in the audit')
  assert.deepEqual(endpoints.filter(match => match[3] === 'true').map(match => match[2]), [],
    'Reassess ordinary HTTP support when adding synchronous shared-memory RPC')
})

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'songloft-embedded-web-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const repo = join(dir, 'client')
  const core = join(repo, 'node_modules/@lynx-js/web-core/dist/client_prod/static')
  for (const folder of ['scripts', 'web', 'dist/web', 'node_modules/@lynx-js/web-core/dist/client_prod/static/css']) {
    mkdirSync(join(repo, folder), { recursive: true })
  }
  cpSync(join(root, 'scripts/copy-bundle-web.mjs'), join(repo, 'scripts/copy-bundle-web.mjs'))
  for (const file of readdirSync(join(root, 'web'), { withFileTypes: true })) {
    if (file.isFile()) cpSync(join(root, 'web', file.name), join(repo, 'web', file.name))
  }
  writeFileSync(join(core, 'css/client.css'), '/* fixture */')
  writeFileSync(join(repo, 'dist/web/main.web.bundle'), '// compiled web fixture')
  const out = join(dir, 'output')
  const copy = embedded => execFileSync(process.execPath,
    [join(repo, 'scripts/copy-bundle-web.mjs'), ...(embedded ? ['--embedded'] : []), '--out-dir', out],
    { encoding: 'utf8' })
  return { out, copy }
}

test('embedded assets resolve from root and BASE_PATH even for legacy SPA bookmarks', t => {
  const { out, copy } = fixture(t)
  copy(true)
  const html = readFileSync(join(out, 'index.html'), 'utf8')
  assert.equal((html.match(/<base href="\/">/g) ?? []).length, 1)
  assert.ok(!html.includes('global-props=\'{"deployMode":"standalone"}\''))
  for (const prefix of ['', '/songloft']) {
    const served = html.replace('<base href="/">', `<base href="${prefix}/">`)
    const base = /<base href="([^"]+)">/.exec(served)[1]
    const documentBase = new URL(base, `https://music.test${prefix}/settings/category/2`)
    assert.equal(new URL('./main.lynx.bundle', documentBase).pathname, `${prefix}/main.lynx.bundle`)
  }
  writeFileSync(join(out, 'flutter.js'), 'obsolete Flutter file')
  copy(true)
  assert.ok(!readdirSync(out).includes('flutter.js'))
})

test('standalone retains the document directory and server-address control', t => {
  const { out, copy } = fixture(t)
  copy(false)
  const html = readFileSync(join(out, 'index.html'), 'utf8')
  assert.ok(!html.includes('<base href="/">'))
  assert.ok(html.includes('global-props=\'{"deployMode":"standalone"}\''))
})
