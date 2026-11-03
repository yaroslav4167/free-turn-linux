import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = (path) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')

test('VPN lists expose individual modes, enable switches and newline-preserving entries', () => {
  const ui = read('desktop/frontend/src/components/VPNRoutingLists.tsx')
  assert.match(ui, /value="blacklist"/)
  assert.match(ui, /value="whitelist"/)
  assert.match(ui, /checked=\{list\.enabled\}/)
  assert.match(ui, /entries: e\.target\.value\.split\('\\n'\)/)
  assert.match(ui, /DNS при подключении/)
  assert.match(ui, /не защита от утечек/)
})

test('invalid DNS or routing lists are rejected before disconnecting the old VPN', () => {
  const engine = read('desktop/backend/engine.go')
  assert.ok(engine.indexOf('routing.Build(') < engine.indexOf('e.forceStop()'))
  assert.match(engine, /ConnectWithRoutes\(cfg, srv\.WgClientConf, DefaultTunnelMTU, routeOverride/)
})
