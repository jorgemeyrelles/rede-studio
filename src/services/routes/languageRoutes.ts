import {
    loadStoredLanguage,
    saveStoredLanguage,
} from '../_core/languagePreference';

export const languageRoutes = {
  getStoredLanguage: loadStoredLanguage,
  setStoredLanguage: saveStoredLanguage,
};
