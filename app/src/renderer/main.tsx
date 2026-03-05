import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Agentation } from 'agentation'

import { App } from './App'
import { shouldRenderAgentation } from './lib/agentation'
import './app.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element #root was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
    {shouldRenderAgentation(import.meta.env.DEV, import.meta.env.VITE_DISABLE_AGENTATION) && (
      <Agentation endpoint="http://localhost:4747" />
    )}
  </StrictMode>
)
