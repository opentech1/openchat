//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  { ignores: ['.output/**', 'dist/**', '.vinxi/**', '*.config.js'] },
  ...tanstackConfig,
]
