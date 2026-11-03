import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

test('interface has no blur, shadows or decorative gradients', () => {
  assert.doesNotMatch(css, /(?:backdrop-filter|\bfilter|box-shadow)\s*:/)
  assert.doesNotMatch(css, /(?:radial|linear|conic)-gradient\s*\(/)
  assert.doesNotMatch(css, /\.app-shell::(?:before|after)/)
})

test('idle screens and traffic charts do not animate', () => {
  const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1])
  assert.deepEqual(keyframes, ['connection-trace'])
  assert.match(css, /\.power-button\[aria-busy='true'\] \.power-progress-path\s*\{\s*animation:\s*connection-trace/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.doesNotMatch(css, /(?:ambient-drift|page-arrive|panel-arrive|chart-draw|chart-fill)/)
})

test('flat styling retains focus, connection, error and disabled states', () => {
  assert.match(css, /button:focus-visible[\s\S]*?outline:\s*2px solid var\(--accent\)/)
  assert.match(css, /\.connected \.power-button\s*\{[^}]*border-color:/)
  assert.match(css, /\.error \.power-button\s*\{[^}]*border-color:/)
  assert.match(css, /\.power-button:disabled\s*\{[^}]*opacity:/)
})
