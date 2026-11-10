// Main entry point

import { render } from 'solid-js/web'
import { QueryClientProvider } from '@tanstack/solid-query'
import { queryClient } from './lib/queryClient'
import App from './app'
import './index.css'

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  ),
  document.getElementById('root')!
)
