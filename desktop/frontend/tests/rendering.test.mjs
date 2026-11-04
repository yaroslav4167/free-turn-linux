import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')

test('native WebKit startup configures compatibility before creating the window', () => {
  const main = read('desktop/main.go')
  assert.match(main, /WebviewGpuPolicy:\s+rendering\.policy/)
  assert.ok(main.indexOf('configureRendering(os.Args[1:])') < main.indexOf('wails.Run('))
  assert.doesNotMatch(main, /WebviewGpuPolicy:\s+linux\.WebviewGpuPolicyNever/)
})

test('renderer selection and compatibility notices are absent from settings', () => {
  const component = read('desktop/frontend/src/components/DesktopPreferences.tsx')
  assert.doesNotMatch(component, /SetRenderingMode|rendering-mode-field|settings\.renderingMode/)
  assert.doesNotMatch(component, /settings\.renderingNote/)
})
