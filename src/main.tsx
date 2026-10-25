import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

// any successful change may clear (or add) something that needs attention, so refresh the nav badges
const qc: QueryClient = new QueryClient({
  mutationCache: new MutationCache({ onSuccess: () => { qc.invalidateQueries({ queryKey: ['alerts'] }) } }),
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary><App /></ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
