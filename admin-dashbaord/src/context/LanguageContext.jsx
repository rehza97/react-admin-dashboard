import { createContext, useState, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";

// Create the language context with default value
const LanguageContext = createContext({
  currentLanguage: "en",
  changeLanguage: () => {},
  languages: [
    { code: "en", name: "English" },
    { code: "fr", name: "Français" },
  ],
});

// Custom hook to use the language context
export const useLanguage = () => useContext(LanguageContext);

// Language provider component
export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || "en");

  // Function to change the language
  const changeLanguage = (language) => {
    i18n.changeLanguage(language);
    setCurrentLanguage(language);
    localStorage.setItem("i18nextLng", language);
  };

  // Update the current language when i18n.language changes
  useEffect(() => {
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  // Value to be provided by the context
  const value = {
    currentLanguage,
    changeLanguage,
    languages: [
      { code: "en", name: "English" },
      { code: "fr", name: "Français" },
    ],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

LanguageProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
