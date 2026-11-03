import { createRoot } from 'react-dom/client'
import '../index.css'
import { LanguageProvider } from '../i18n'
import Gallery from './Gallery'

createRoot(document.getElementById('root')).render(
  <LanguageProvider>
    <Gallery />
  </LanguageProvider>,
)
