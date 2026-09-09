import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

let msalInitPromise: Promise<PublicClientApplication> | null = null;

function getMsalInstance(clientId: string): Promise<PublicClientApplication> {
  if (!msalInitPromise) {
    const config: Configuration = {
      auth: {
        clientId,
        // "common" aceita conta pessoal + qualquer tenant organizacional —
        // precisa bater com o app registrado como multi-tenant no Azure.
        authority: 'https://login.microsoftonline.com/common',
      },
    };
    const instance = new PublicClientApplication(config);
    msalInitPromise = instance.initialize().then(() => instance);
  }
  return msalInitPromise;
}

/**
 * Abre o popup "Continuar com a Microsoft" e resolve com o ID token (JWT)
 * do usuário. Popup em vez de redirect de página inteira — evita conflito
 * com o HashRouter do app.
 */
export async function signInWithMicrosoft(): Promise<string> {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_MICROSOFT_CLIENT_ID não configurado');
  }

  const instance = await getMsalInstance(clientId);
  const result = await instance.loginPopup({ scopes: ['openid', 'profile', 'email'] });
  return result.idToken;
}
