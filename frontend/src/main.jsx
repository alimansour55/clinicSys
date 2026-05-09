import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import AppContextProvider from './context/AppContext.jsx'
import { LanguageProvider } from './i18n.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <LanguageProvider>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </LanguageProvider>
  </BrowserRouter>,
)
