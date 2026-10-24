import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } } })

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
