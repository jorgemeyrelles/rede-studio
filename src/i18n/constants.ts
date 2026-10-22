import type { AppLanguage } from '../types/i18n';
import type {
  AuthErrorCopy,
  LandingPageCopy,
  LoginPageCopy,
  ProjectsPageCopy,
  RegisterPageCopy,
  SettingsModalCopy,
  UserMenuCopy,
} from './types';

export const LANDING_PAGE_COPY: Record<AppLanguage, LandingPageCopy> = {
  pt: {
    brand: 'REDE · STUDIO',
    tagline: 'Documentação e modelagem visual de rede corporativa',
    heroTitle: 'Desenhe, documente e valide sua',
    heroTitleHighlight: 'rede corporativa',
    heroSubtitle:
      'Modele sites, VLANs, rotas e regras de firewall num diagrama interativo, e gere o relatório técnico completo em PDF — tudo numa única ferramenta.',
    ctaLogin: 'Entrar',
    ctaRegister: 'Criar conta grátis',
    featuresTitle: 'O que dá pra fazer no Studio',
    features: [
      {
        icon: 'diagram',
        title: 'Diagrama interativo',
        description:
          'Monte sites, camadas e dispositivos visualmente, com tooltips técnicos em cada nó e link.',
      },
      {
        icon: 'routes',
        title: 'Rotas geradas automaticamente',
        description:
          'Direta, Estática, Default, VPN e BGP calculadas a partir da topologia que você desenhar.',
      },
      {
        icon: 'firewall',
        title: 'Firewall e ACL',
        description:
          'Regras de segurança derivadas da rede, com QoS, exceções de retorno e edição manual.',
      },
      {
        icon: 'addressing',
        title: 'VLANs e endereçamento',
        description:
          'Cadastro de VLANs por site com faixas de IP calculadas automaticamente.',
      },
      {
        icon: 'protocols',
        title: 'Protocolos de roteamento',
        description:
          'Configuração inline de OSPF e BGP por roteador, direto na tabela.',
      },
      {
        icon: 'report',
        title: 'Relatório técnico em PDF',
        description:
          'Exporte diagrama, tabelas e anexos num documento pronto pra entregar ao cliente.',
      },
    ],
    footerNote: 'Projeto salvo por conta — acesse de onde quiser continuar.',
  },
  en: {
    brand: 'NETWORK · STUDIO',
    tagline: 'Documentation and visual modeling for corporate networks',
    heroTitle: 'Design, document and validate your',
    heroTitleHighlight: 'corporate network',
    heroSubtitle:
      'Model sites, VLANs, routes and firewall rules in an interactive diagram, then export the full technical report as a PDF — all in one tool.',
    ctaLogin: 'Sign in',
    ctaRegister: 'Sign up for free',
    featuresTitle: 'What you can do in Studio',
    features: [
      {
        icon: 'diagram',
        title: 'Interactive diagram',
        description:
          'Build sites, layers and devices visually, with technical tooltips on every node and link.',
      },
      {
        icon: 'routes',
        title: 'Auto-generated routes',
        description:
          'Direct, Static, Default, VPN and BGP routes computed from the topology you draw.',
      },
      {
        icon: 'firewall',
        title: 'Firewall & ACL',
        description:
          'Security rules derived from the network, with QoS, return exceptions and manual edits.',
      },
      {
        icon: 'addressing',
        title: 'VLANs & addressing',
        description:
          'Register VLANs per site with IP ranges calculated automatically.',
      },
      {
        icon: 'protocols',
        title: 'Routing protocols',
        description:
          'Inline OSPF and BGP configuration per router, right in the table.',
      },
      {
        icon: 'report',
        title: 'Technical PDF report',
        description:
          'Export the diagram, tables and annexes into a document ready to hand to your client.',
      },
    ],
    footerNote:
      'Project saved per account — pick up right where you left off, anywhere.',
  },
  es: {
    brand: 'RED · STUDIO',
    tagline: 'Documentación y modelado visual de red corporativa',
    heroTitle: 'Diseña, documenta y valida tu',
    heroTitleHighlight: 'red corporativa',
    heroSubtitle:
      'Modela sitios, VLANs, rutas y reglas de firewall en un diagrama interactivo, y genera el informe técnico completo en PDF — todo en una sola herramienta.',
    ctaLogin: 'Entrar',
    ctaRegister: 'Crear cuenta gratis',
    featuresTitle: 'Qué puedes hacer en Studio',
    features: [
      {
        icon: 'diagram',
        title: 'Diagrama interactivo',
        description:
          'Arma sitios, capas y dispositivos visualmente, con tooltips técnicos en cada nodo y enlace.',
      },
      {
        icon: 'routes',
        title: 'Rutas generadas automáticamente',
        description:
          'Directa, Estática, Default, VPN y BGP calculadas a partir de la topología que dibujes.',
      },
      {
        icon: 'firewall',
        title: 'Firewall y ACL',
        description:
          'Reglas de seguridad derivadas de la red, con QoS, excepciones de retorno y edición manual.',
      },
      {
        icon: 'addressing',
        title: 'VLANs y direccionamiento',
        description:
          'Registro de VLANs por sitio con rangos de IP calculados automáticamente.',
      },
      {
        icon: 'protocols',
        title: 'Protocolos de enrutamiento',
        description:
          'Configuración en línea de OSPF y BGP por router, directo en la tabla.',
      },
      {
        icon: 'report',
        title: 'Informe técnico en PDF',
        description:
          'Exporta el diagrama, tablas y anexos en un documento listo para entregar al cliente.',
      },
    ],
    footerNote: 'Proyecto guardado por cuenta — continúa desde donde quieras.',
  },
};

export const LOGIN_PAGE_COPY: Record<AppLanguage, LoginPageCopy> = {
  pt: {
    title: 'Entrar',
    subtitle: 'Acesse seus projetos salvos.',
    emailLabel: 'E-mail',
    passwordLabel: 'Senha',
    submit: 'Entrar',
    submitting: 'Entrando...',
    noAccountText: 'Ainda não tem conta?',
    registerLinkText: 'Criar conta',
    backToHome: '← Voltar',
    orDivider: 'ou',
    continueWithMicrosoft: 'Continuar com a Microsoft',
  },
  en: {
    title: 'Sign in',
    subtitle: 'Access your saved projects.',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in...',
    noAccountText: "Don't have an account?",
    registerLinkText: 'Sign up',
    backToHome: '← Back',
    orDivider: 'or',
    continueWithMicrosoft: 'Continue with Microsoft',
  },
  es: {
    title: 'Entrar',
    subtitle: 'Accede a tus proyectos guardados.',
    emailLabel: 'Correo electrónico',
    passwordLabel: 'Contraseña',
    submit: 'Entrar',
    submitting: 'Entrando...',
    noAccountText: '¿Aún no tienes cuenta?',
    registerLinkText: 'Crear cuenta',
    backToHome: '← Volver',
    orDivider: 'o',
    continueWithMicrosoft: 'Continuar con Microsoft',
  },
};

export const REGISTER_PAGE_COPY: Record<AppLanguage, RegisterPageCopy> = {
  pt: {
    title: 'Criar conta',
    subtitle: 'Salve seus projetos e continue de onde parou.',
    nameLabel: 'Nome',
    emailLabel: 'E-mail',
    passwordLabel: 'Senha',
    confirmPasswordLabel: 'Confirmar senha',
    passwordMismatch: 'As senhas não coincidem.',
    submit: 'Criar conta',
    submitting: 'Criando conta...',
    hasAccountText: 'Já tem conta?',
    loginLinkText: 'Entrar',
    backToHome: '← Voltar',
    orDivider: 'ou',
    continueWithMicrosoft: 'Continuar com a Microsoft',
  },
  en: {
    title: 'Sign up',
    subtitle: 'Save your projects and pick up where you left off.',
    nameLabel: 'Name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm password',
    passwordMismatch: 'Passwords do not match.',
    submit: 'Sign up',
    submitting: 'Signing up...',
    hasAccountText: 'Already have an account?',
    loginLinkText: 'Sign in',
    backToHome: '← Back',
    orDivider: 'or',
    continueWithMicrosoft: 'Continue with Microsoft',
  },
  es: {
    title: 'Crear cuenta',
    subtitle: 'Guarda tus proyectos y continúa donde los dejaste.',
    nameLabel: 'Nombre',
    emailLabel: 'Correo electrónico',
    passwordLabel: 'Contraseña',
    confirmPasswordLabel: 'Confirmar contraseña',
    passwordMismatch: 'Las contraseñas no coinciden.',
    submit: 'Crear cuenta',
    submitting: 'Creando cuenta...',
    hasAccountText: '¿Ya tienes cuenta?',
    loginLinkText: 'Entrar',
    backToHome: '← Volver',
    orDivider: 'o',
    continueWithMicrosoft: 'Continuar con Microsoft',
  },
};

export const PROJECTS_PAGE_COPY: Record<AppLanguage, ProjectsPageCopy> = {
  pt: {
    title: 'Meus projetos',
    subtitle: 'Continue um projeto salvo ou comece um novo.',
    newProjectButton: 'Novo projeto',
    emptyStateTitle: 'Nenhum projeto ainda',
    emptyStateSubtitle:
      'Crie o primeiro projeto pra começar a modelar sua rede.',
    lastEditedLabel: 'Editado em',
    openProject: 'Abrir',
    newProjectModalTitle: 'Novo projeto',
    projectNameLabel: 'Nome do projeto',
    networkTypeLabel: 'Tipo de rede',
    networkTypeOptions: {
      ON_PREMISE: 'On-premise',
      CLOUD: 'Cloud',
      MULTI_CLOUD: 'Multi-cloud',
      HYBRID: 'Mista',
    },
    createButton: 'Criar projeto',
    creating: 'Criando…',
    cancelButton: 'Cancelar',
    defaultProjectNamePrefix: 'Novo Projeto',
    renameAriaLabel: 'Renomear projeto',
    comingSoon: 'Em breve',
    networkTypeComingSoonHint:
      'Multi-cloud e redes mistas chegam em breve. Cloud abre o Studio Cloud (AWS).',
    deleteAriaLabel: 'Excluir projeto',
    deleteModalTitle: 'Excluir projeto',
    deleteModalBody:
      'O projeto e toda a topologia dele (sites, VLANs, rotas, firewall) serão removidos. Não dá para desfazer.',
    deleteConfirmLabel: 'Digite o nome do projeto para confirmar',
    deleteConfirmHint: 'O botão de excluir habilita quando o texto for exatamente:',
    deleteButton: 'Excluir projeto',
    deleting: 'Excluindo…',
    deleteError: 'Não foi possível excluir o projeto. Tente novamente.',
    emptyStateCta: 'Criar primeiro projeto',
    loading: 'Carregando projetos…',
    loadError: 'Não foi possível carregar seus projetos.',
    retry: 'Tentar novamente',
  },
  en: {
    title: 'My projects',
    subtitle: 'Continue a saved project or start a new one.',
    newProjectButton: 'New project',
    emptyStateTitle: 'No projects yet',
    emptyStateSubtitle:
      'Create your first project to start modeling your network.',
    lastEditedLabel: 'Last edited',
    openProject: 'Open',
    newProjectModalTitle: 'New project',
    projectNameLabel: 'Project name',
    networkTypeLabel: 'Network type',
    networkTypeOptions: {
      ON_PREMISE: 'On-premise',
      CLOUD: 'Cloud',
      MULTI_CLOUD: 'Multi-cloud',
      HYBRID: 'Hybrid',
    },
    createButton: 'Create project',
    creating: 'Creating…',
    cancelButton: 'Cancel',
    defaultProjectNamePrefix: 'New Project',
    renameAriaLabel: 'Rename project',
    comingSoon: 'Coming soon',
    networkTypeComingSoonHint:
      'Multi-cloud and hybrid networks are coming soon. Cloud opens the Cloud Studio (AWS).',
    deleteAriaLabel: 'Delete project',
    deleteModalTitle: 'Delete project',
    deleteModalBody:
      'The project and its whole topology (sites, VLANs, routes, firewall) will be removed. This cannot be undone.',
    deleteConfirmLabel: 'Type the project name to confirm',
    deleteConfirmHint: 'The delete button enables when the text is exactly:',
    deleteButton: 'Delete project',
    deleting: 'Deleting…',
    deleteError: 'Could not delete the project. Please try again.',
    emptyStateCta: 'Create first project',
    loading: 'Loading projects…',
    loadError: 'Could not load your projects.',
    retry: 'Try again',
  },
  es: {
    title: 'Mis proyectos',
    subtitle: 'Continúa un proyecto guardado o empieza uno nuevo.',
    newProjectButton: 'Nuevo proyecto',
    emptyStateTitle: 'Aún no hay proyectos',
    emptyStateSubtitle:
      'Crea tu primer proyecto para empezar a modelar tu red.',
    lastEditedLabel: 'Editado el',
    openProject: 'Abrir',
    newProjectModalTitle: 'Nuevo proyecto',
    projectNameLabel: 'Nombre del proyecto',
    networkTypeLabel: 'Tipo de red',
    networkTypeOptions: {
      ON_PREMISE: 'On-premise',
      CLOUD: 'Cloud',
      MULTI_CLOUD: 'Multi-cloud',
      HYBRID: 'Mixta',
    },
    createButton: 'Crear proyecto',
    creating: 'Creando…',
    cancelButton: 'Cancelar',
    defaultProjectNamePrefix: 'Nuevo Proyecto',
    renameAriaLabel: 'Renombrar proyecto',
    comingSoon: 'Próximamente',
    networkTypeComingSoonHint:
      'Multi-cloud y redes mixtas llegan pronto. Cloud abre el Studio Cloud (AWS).',
    deleteAriaLabel: 'Eliminar proyecto',
    deleteModalTitle: 'Eliminar proyecto',
    deleteModalBody:
      'El proyecto y toda su topología (sites, VLANs, rutas, firewall) serán eliminados. No se puede deshacer.',
    deleteConfirmLabel: 'Escribe el nombre del proyecto para confirmar',
    deleteConfirmHint: 'El botón de eliminar se habilita cuando el texto sea exactamente:',
    deleteButton: 'Eliminar proyecto',
    deleting: 'Eliminando…',
    deleteError: 'No se pudo eliminar el proyecto. Inténtalo de nuevo.',
    emptyStateCta: 'Crear primer proyecto',
    loading: 'Cargando proyectos…',
    loadError: 'No se pudieron cargar tus proyectos.',
    retry: 'Reintentar',
  },
};

export const USER_MENU_COPY: Record<AppLanguage, UserMenuCopy> = {
  pt: {
    myProjects: 'Meus projetos',
    newProject: 'Novo projeto',
    settings: 'Configurações',
    logout: 'Sair',
    loggingOut: 'Salvando e saindo…',
  },
  en: {
    myProjects: 'My projects',
    newProject: 'New project',
    settings: 'Settings',
    logout: 'Log out',
    loggingOut: 'Saving and logging out…',
  },
  es: {
    myProjects: 'Mis proyectos',
    newProject: 'Nuevo proyecto',
    settings: 'Configuración',
    logout: 'Salir',
    loggingOut: 'Guardando y saliendo…',
  },
};

export const SETTINGS_MODAL_COPY: Record<AppLanguage, SettingsModalCopy> = {
  pt: {
    title: 'Configurações',
    nameLabel: 'Nome',
    languageLabel: 'Idioma',
    passwordNote: 'A senha pode ser alterada na tela de login.',
    saveButton: 'Salvar',
    saving: 'Salvando...',
    cancelButton: 'Cancelar',
    savedConfirmation: 'Salvo!',
  },
  en: {
    title: 'Settings',
    nameLabel: 'Name',
    languageLabel: 'Language',
    passwordNote: 'Password can be changed from the login screen.',
    saveButton: 'Save',
    saving: 'Saving...',
    cancelButton: 'Cancel',
    savedConfirmation: 'Saved!',
  },
  es: {
    title: 'Configuración',
    nameLabel: 'Nombre',
    languageLabel: 'Idioma',
    passwordNote:
      'La contraseña se puede cambiar desde la pantalla de inicio de sesión.',
    saveButton: 'Guardar',
    saving: 'Guardando...',
    cancelButton: 'Cancelar',
    savedConfirmation: '¡Guardado!',
  },
};

export const AUTH_ERROR_COPY: Record<AppLanguage, AuthErrorCopy> = {
  pt: {
    EMAIL_TAKEN: 'E-mail já cadastrado.',
    INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
    USER_NOT_FOUND: 'Usuário não encontrado.',
    NOT_AUTHENTICATED: 'Você precisa estar logado.',
    VALIDATION_ERROR: 'Dados inválidos. Confira os campos e tente novamente.',
    OAUTH_FAILED:
      'Não foi possível continuar com esse provedor. Tente novamente.',
    GENERIC: 'Algo deu errado. Tente novamente.',
  },
  en: {
    EMAIL_TAKEN: 'Email already registered.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    USER_NOT_FOUND: 'User not found.',
    NOT_AUTHENTICATED: 'You need to be logged in.',
    VALIDATION_ERROR: 'Invalid data. Check the fields and try again.',
    OAUTH_FAILED: 'Could not continue with that provider. Please try again.',
    GENERIC: 'Something went wrong. Please try again.',
  },
  es: {
    EMAIL_TAKEN: 'Correo ya registrado.',
    INVALID_CREDENTIALS: 'Correo o contraseña inválidos.',
    USER_NOT_FOUND: 'Usuario no encontrado.',
    NOT_AUTHENTICATED: 'Necesitas iniciar sesión.',
    VALIDATION_ERROR: 'Datos inválidos. Revisa los campos e intenta de nuevo.',
    OAUTH_FAILED: 'No se pudo continuar con ese proveedor. Inténtalo de nuevo.',
    GENERIC: 'Algo salió mal. Inténtalo de nuevo.',
  },
};
