import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'
import { SiteFooter } from './components/SiteFooter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
    <SiteFooter />
  </StrictMode>,
)
