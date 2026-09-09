import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import { initClarity } from './services/observability/clarity';
import './styles/tailwind.css';
import './styles/global.css';

initClarity();

const rootEl = document.getElementById('root') as HTMLElement;

// Dev: navegar direto pra uma URL "amigável" (ex.: /pt/studio/abc) sem
// hash não é reconhecido pelo HashRouter — reescreve pra .../#/pt/studio/abc
// antes do React montar. Generalizado (não mais só /studio e /slides)
// porque agora toda rota vive sob um prefixo de idioma (/:lang/...).
if (
  import.meta.env.DEV &&
  !window.location.hash &&
  window.location.pathname !== '/'
) {
  window.history.replaceState(
    null,
    '',
    `/#${window.location.pathname}${window.location.search}`,
  );
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </HashRouter>
    </Provider>
  </React.StrictMode>,
);
