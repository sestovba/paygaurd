import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// The palette first: ledger.css and payguard.css do not declare colours any
// more, they alias --t-*. One file decides what every variant looks like.
import './styles/palette.css';
import './styles/ledger.css';
import './styles/payguard.css';
import './styles/workrecord.css';
import './styles/calc20.css';
// Last, so the shared chrome (toasts, the bell, its panel) can be overridden
// by a layout that wants its own placement — see .pg-calc20 .toast-stack.
import './styles/chrome.css';
import './styles/overlay.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
