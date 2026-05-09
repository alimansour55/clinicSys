import { createContext } from "react";
import { useLanguage } from "../i18n";


export const AppContext = createContext()

const AppContextProvider = (props) => {

    const { language, t, tc } = useLanguage()
    const currency = language === 'ar' ? 'ج.م ' : 'EGP '


    const calculateAge = (dob) => {
      const today = new Date()
      const birthDate = new Date(dob)

      let age = today.getFullYear() - birthDate.getFullYear()
      return age
    }

    const months = language === 'ar'
      ? [ "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
      : [ "", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const slotDateFormat = (slotDate) => {
    const dateArray = slotDate.split('_')
    return dateArray[0]+ " " + months[Number(dateArray[1])]+ " " + dateArray[2]
  }

    const value = {
       calculateAge,
       slotDateFormat,
       currency,
       language,
       t,
       tc
    }

    return (
        <AppContext.Provider value={value}>
           {props.children}
        </AppContext.Provider>
    )
}

export default AppContextProvider
