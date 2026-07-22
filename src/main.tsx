import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { assertBrowserOrigin, loadLatteRuntimeConfig } from '@erme2/latte'
import App from './App'
import './index.css'
import { product } from './product/manifest'
import { createLatteRuntime } from './product/contract'

const root = createRoot(document.getElementById('root')!)

async function start(): Promise<void> {
  try {
    const config = await loadLatteRuntimeConfig()
    assertBrowserOrigin(config, window.location.origin)
    const runtime = createLatteRuntime(config, product)
    root.render(
      <StrictMode>
        <App runtime={runtime} product={product} />
      </StrictMode>,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Latte configuration.'
    root.render(<main><h1>Application configuration error</h1><p>{message}</p></main>)
  }
}

void start()
