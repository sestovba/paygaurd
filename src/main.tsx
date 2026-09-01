import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/ledger.css';
import './styles/payguard.css';
import './styles/workrecord.css';
import './styles/calc20.css';
// Last, so the shared chrome (toasts, the bell, its panel) can be overridden
// by a layout that wants its own placement — see .pg-calc20 .toast-stack.
import './styles/chrome.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
