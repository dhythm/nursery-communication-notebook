import type { RuntimeConfig } from './runtime-config'

export function shouldSeedDemoData(appEnv: RuntimeConfig['appEnv']) {
  return appEnv !== 'production'
}
