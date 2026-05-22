import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import AdminContextProvider from './context/AdminContext.jsx'
import DoctorContextProvider from './context/DoctorContext.jsx'
import AppContextProvider from './context/AppContext.jsx'
import ReceptionistContextProvider from './context/ReceptionistContext.jsx'
import { LanguageProvider } from './i18n.jsx'

createRoot(document.getElementById('root')).render(

  <BrowserRouter unstable_useTransitions={false}>
    <LanguageProvider>
      <AdminContextProvider>
        <DoctorContextProvider>
          <ReceptionistContextProvider>
            <AppContextProvider>
              <App />
            </AppContextProvider>
          </ReceptionistContextProvider>
        </DoctorContextProvider>
      </AdminContextProvider>
    </LanguageProvider>
    
  </BrowserRouter>,
)
