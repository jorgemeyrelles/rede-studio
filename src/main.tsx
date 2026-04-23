import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { store } from './app/store';
import './styles/tailwind.css';
import './styles/global.css';

const rootEl = document.getElementById('root') as HTMLElement;

if (
  import.meta.env.DEV &&
  !window.location.hash &&
  (window.location.pathname === '/studio' ||
    window.location.pathname === '/slides')
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
