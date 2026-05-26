import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import App from './App';
import queryClient from './lib/queryClient';
import { apiBaseURL } from './lib/api';
import { setCSRFToken } from '@/utils/csrf';
import './index.css';

async function bootstrap() {
  const response = await fetch(`${apiBaseURL}/csrf/`, {
    method: 'GET',
    credentials: 'include',
  }).catch(() => undefined)

  if (response) {
    const data = await response.json().catch(() => null)
    if (data?.csrfToken) {
      setCSRFToken(data.csrfToken)
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: '10px',
              background: '#1e293b',
              color: '#f8fafc',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#f8fafc' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f8fafc' } },
          }}
        />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap()
