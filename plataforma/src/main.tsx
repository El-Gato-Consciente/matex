import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Splash } from './components/Splash'
import { AccountProvider } from './features/account/AccountProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID} apiBaseUrl={import.meta.env.VITE_COMPILE_API_URL}>
      <App />
    </AccountProvider>
    <Splash />
  </StrictMode>,
)
