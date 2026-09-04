import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// The two token files first, then the controls built out of them, then the
// layouts. palette.css decides every colour; metrics.css decides every size,
// space and shape; controls.css draws the shared button and field using
// nothing but those two. A layout stylesheet below this point may map and
// override — it may not choose.
import './styles/palette.css';
import './styles/metrics.css';
import './styles/controls.css';
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
