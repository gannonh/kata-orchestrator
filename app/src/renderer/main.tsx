import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Agentation } from 'agentation'

import { App } from './App'
import './app.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element #root was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
    {import.meta.env.DEV && <Agentation endpoint="http://localhost:4747" />}
  </StrictMode>
)
