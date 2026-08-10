window.global = window;
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

try {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element not found');
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error('App failed to start', error);
  document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">App failed to start. Clear your browser storage and reload.</p>';
}
