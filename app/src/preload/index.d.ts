import type { KataApi } from './index'

export type PreloadKataApi = KataApi

declare global {
  interface Window {
    kata?: PreloadKataApi
  }
}

export {}
