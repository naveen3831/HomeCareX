import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderPage(ui: ReactElement, route = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

export const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
};

export const networkError = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', isAxiosError: true });
export const serverError = () => Object.assign(new Error('Request failed with status code 500'), { isAxiosError: true, response: { status: 500, data: { message: 'Server exploded' } } });
export const pending = () => new Promise<never>(() => {});
