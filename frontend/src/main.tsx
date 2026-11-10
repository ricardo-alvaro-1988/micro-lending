import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { BranchProvider } from './branch/BranchContext'
import { ToastProvider } from './toast/ToastContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
