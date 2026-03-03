import type { KataApi } from '../../preload/index'

declare global {
  interface Window {
    kata?: KataApi
  }
}

export {}
