import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { expect, test, vi } from 'vitest'

const require = createRequire(import.meta.url)
const packageRoot = dirname(dirname(require.resolve('@lynx-js/lynx-ui-input')))

// Execute the installed input controller on both sides of its asynchronous
// main-thread/background boundary. Desktop DOM focus alone cannot detect an
// Android IME being dismissed when readonly briefly becomes true.
for (const element of ['Input', 'TextArea']) {
  for (const format of ['src', 'dist']) {
    const extension = format === 'src' ? 'tsx' : 'jsx'
    const raw = readFileSync(join(packageRoot, format, `${element}.${extension}`), 'utf8')
    const source = ts.transpileModule(raw, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve } }).outputText
    const start = source.indexOf('{', source.indexOf(`function ${element}Impl(`)) + 1
    const end = source.indexOf('useImperativeHandle(', start)

    function controller(platform: string | undefined, controlled = true) {
      expect(start).toBeGreaterThan(0)
      expect(end).toBeGreaterThan(start)
      const queue: (() => void)[] = []
      const input = { readonly: false, setAttribute: vi.fn<(name: string, value: boolean) => void>() }
      input.setAttribute.mockImplementation((_name, value) => { input.readonly = value })
      const change = vi.fn()
      const nativeProps = vi.fn((_ref: unknown, props: { readonly: boolean }) => { input.readonly = props.readonly })
      const run = new Function('useRef', 'useContext', 'useEffect', 'runOnBackground', 'setNativePropsByRef', 'KeyboardAwareTriggerContext', 'props', 'SystemInfo',
        source.slice(start, end) + '\nreturn {onInputContentDidChanged};')
      const result = run(
        (current: unknown) => ({ current }), () => ({}), () => {},
        (callback: (...args: unknown[]) => void) => (...args: unknown[]) => queue.push(() => callback(...args)),
        nativeProps, {}, { ...(controlled ? { value: '' } : {}), onInput: change },
        platform === undefined ? undefined : { platform },
      ) as { onInputContentDidChanged: (event: unknown) => void }
      const type = (value: string, composing = false) => result.onInputContentDidChanged({
        currentTarget: input, detail: { value, selectionStart: value.length, selectionEnd: value.length, isComposing: composing },
      })
      return { input, change, nativeProps, type, flush: () => queue.splice(0).forEach(fn => fn()) }
    }

    test(`${format}/${element}: Web typing never toggles the browser readonly attribute`, () => {
      const c = controller('web')
      for (const value of ['a', 'ab', 'abc']) {
        c.type(value)
        expect(c.input.readonly).toBe(false)
        c.flush()
      }
      expect(c.input.setAttribute).not.toHaveBeenCalled()
      expect(c.nativeProps).not.toHaveBeenCalled()
      expect(c.change.mock.calls.map(call => call[0])).toEqual(['a', 'ab', 'abc'])
    })

    test(`${format}/${element}: Web composition preserves text, selection and composing state`, () => {
      const c = controller('web')
      c.type('ni', true)
      c.flush()
      c.type('你', false)
      c.flush()
      expect(c.change.mock.calls).toEqual([['ni', 2, 2, true], ['你', 1, 1, false]])
      expect(c.input.setAttribute).not.toHaveBeenCalled()
    })

    test.each(['Android', 'iOS', 'Harmony', undefined])(`${format}/${element}: native controlled lock remains on %s`, platform => {
      const c = controller(platform)
      c.type('a')
      expect(c.input.readonly).toBe(true)
      expect(c.change).not.toHaveBeenCalled()
      c.flush()
      expect(c.change).toHaveBeenCalledExactlyOnceWith('a', 1, 1, false)
      expect(c.input.readonly).toBe(false)
    })

    test.each(['web', 'Android'])(`${format}/${element}: uncontrolled %s input stays editable`, platform => {
      const c = controller(platform, false)
      c.type('a')
      c.flush()
      expect(c.input.setAttribute).not.toHaveBeenCalled()
      expect(c.change).toHaveBeenCalledExactlyOnceWith('a', 1, 1, false)
    })

    test(`${format}/${element}: delayed Web echoes cannot overwrite newer edits, but external resets still apply`, () => {
      const refs: { current: unknown }[] = []
      const queue: (() => void)[] = []
      let effects: (() => void)[] = []
      let cursor = 0
      const node = { value: '', setAttribute: vi.fn(), invoke: vi.fn() }
      node.invoke.mockImplementation(({ params, success }) => ({ exec() { node.value = params.value; success() } }))
      const run = new Function('useRef', 'useContext', 'useEffect', 'runOnBackground', 'setNativePropsByRef', 'KeyboardAwareTriggerContext', 'props', 'SystemInfo',
        source.slice(start, end) + '\ninputRef.current = props.node; return onInputContentDidChanged;')
      const render = (value: string) => {
        cursor = 0
        effects = []
        const handler = run(
          (current: unknown) => refs[cursor++] ?? (refs[cursor - 1] = { current }),
          () => ({}), (effect: () => void) => effects.push(effect),
          (callback: (...args: unknown[]) => void) => (...args: unknown[]) => queue.push(() => callback(...args)),
          () => {}, {}, { value, node, onInput: () => {} }, { platform: 'web' },
        ) as (event: unknown) => void
        effects.forEach(effect => effect())
        return handler
      }
      let handler = render('')
      const type = (value: string) => {
        node.value = value
        handler({ currentTarget: node, detail: { value, selectionStart: value.length, selectionEnd: value.length, isComposing: false } })
        queue.splice(0).forEach(fn => fn())
      }
      type('a')
      type('ab')
      type('abc')
      handler = render('a')
      expect(node.value).toBe('abc')
      handler = render('abc')
      expect(node.value).toBe('abc')
      handler = render('')
      expect(node.value).toBe('')
      // Repeated values must acknowledge edits in order, without consuming
      // the last "a" before the intermediate "ab" render is acknowledged.
      type('a')
      type('ab')
      type('a')
      handler = render('a')
      handler = render('ab')
      expect(node.value).toBe('a')
      handler = render('a')
      handler = render('reset')
      expect(node.value).toBe('reset')
    })
  }
}
