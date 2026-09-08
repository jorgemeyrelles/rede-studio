/**
 * Copy dos "chrome" do app (Landing, Login/Registro, Dashboard) — fora do
 * escopo do Studio (que já tem seu próprio i18n em `src/components/studio`).
 */

export type LandingFeature = {
  icon: string;
  title: string;
  description: string;
};

export type LandingPageCopy = {
  brand: string;
  tagline: string;
  heroTitle: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  ctaLogin: string;
  ctaRegister: string;
  featuresTitle: string;
  features: LandingFeature[];
  footerNote: string;
};

export type LoginPageCopy = {
  title: string;
  subtitle: string;
  emailLabel: string;
  passwordLabel: string;
  submit: string;
  submitting: string;
  noAccountText: string;
  registerLinkText: string;
  backToHome: string;
};

export type RegisterPageCopy = {
  title: string;
  subtitle: string;
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  confirmPasswordLabel: string;
  passwordMismatch: string;
  submit: string;
  submitting: string;
  hasAccountText: string;
  loginLinkText: string;
  backToHome: string;
};

export type ProjectsPageCopy = {
  title: string;
  subtitle: string;
  newProjectButton: string;
  emptyStateTitle: string;
  emptyStateSubtitle: string;
  lastEditedLabel: string;
  openProject: string;
  newProjectModalTitle: string;
  projectNameLabel: string;
  createButton: string;
  creating: string;
  cancelButton: string;
  defaultProjectNamePrefix: string;
  renameAriaLabel: string;
};

export type UserMenuCopy = {
  myProjects: string;
  newProject: string;
  settings: string;
  logout: string;
};

export type SettingsModalCopy = {
  title: string;
  nameLabel: string;
  languageLabel: string;
  passwordNote: string;
  saveButton: string;
  saving: string;
  cancelButton: string;
  savedConfirmation: string;
};

export type AuthErrorCopy = {
  EMAIL_TAKEN: string;
  INVALID_CREDENTIALS: string;
  USER_NOT_FOUND: string;
  NOT_AUTHENTICATED: string;
  VALIDATION_ERROR: string;
  GENERIC: string;
};
