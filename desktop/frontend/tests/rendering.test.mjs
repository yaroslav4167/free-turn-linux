import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')

test('native WebKit startup uses the renderer chosen for this launch', () => {
  const main = read('desktop/main.go')
  assert.match(main, /WebviewGpuPolicy:\s+webviewGPUPolicy\(app\.activeRenderingMode\)/)
  assert.doesNotMatch(main, /WebviewGpuPolicy:\s+linux\.WebviewGpuPolicyNever/)
})

test('settings expose renderer modes with an explicit restart notice', () => {
  const component = read('desktop/frontend/src/components/DesktopPreferences.tsx')
  for (const mode of ['auto', 'hardware', 'software']) assert.ok(component.includes(`value="${mode}"`))
  assert.match(component, /SetRenderingMode\(e\.target\.value\)/)
  assert.match(component, /settings\.activeRenderingMode/)
  assert.match(component, /settings\.renderingRestartRequired/)
  assert.match(component, /Закрытие окна в трей не считается перезапуском/)
})
