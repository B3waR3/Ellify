/// <reference types="vite/client" />

import type { EllaApi } from '../electron/preload'

declare global {
  interface Window {
    ella: EllaApi
  }
}

export {}
