import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/catalogApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/catalogApi')>()),
  fetchServices: vi.fn(),
}));

import { fetchServices } from '@/services/catalogApi';
import ServicesPage from '../pages/public/Services';

const fetchServicesMock = vi.mocked(fetchServices);

const LocationDisplay: React.FC = () => <div data-testid="loc">{useLocation().search}</div>;

const renderAt = (url: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[url]}>
          <ServicesPage />
          <LocationDisplay />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  fetchServicesMock.mockReset();
  fetchServicesMock.mockResolvedValue({ items: [], meta: { page: 1, limit: 6, total: 0, totalPages: 1 } });
});

describe('ServicesPage with a tampered URL', () => {
  it('does not crash and requests safe params for page=-1 & sort=injection', async () => {
    renderAt('/services?page=-1&sort=%27%3B%20DROP%20TABLE%20services%3B--&q=' + 'a'.repeat(400));

    await waitFor(() => expect(fetchServicesMock).toHaveBeenCalled());
    const params = fetchServicesMock.mock.calls[0][0];
    expect(params.page).toBe(1);
    expect(params.sort).toBe('popular');
    expect(params.q).toHaveLength(100);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('rewrites the address bar to the sanitised values', async () => {
    renderAt('/services?page=-1&sort=evil&pincode=12');

    await waitFor(() => {
      const search = new URLSearchParams(screen.getByTestId('loc').textContent ?? '');
      expect(search.get('page')).toBeNull();
      expect(search.get('sort')).toBeNull();
      expect(search.get('pincode')).toBeNull();
    });
  });

  it('leaves a clean URL alone', async () => {
    renderAt('/services?category=home-cleaning&sort=price-low&page=2');
    await waitFor(() => expect(fetchServicesMock).toHaveBeenCalled());
    const search = new URLSearchParams(screen.getByTestId('loc').textContent ?? '');
    expect(search.get('sort')).toBe('price-low');
    expect(search.get('page')).toBe('2');
    expect(fetchServicesMock.mock.calls[0][0]).toMatchObject({ sort: 'price-asc', page: 2, category: 'home-cleaning' });
  });
});

describe('ServicesPage offline', () => {
  it('shows the offline state with a retry button instead of an endless skeleton', async () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    fetchServicesMock.mockImplementation(() => new Promise(() => undefined));

    renderAt('/services');
    window.dispatchEvent(new Event('offline'));

    expect(await screen.findByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    online.mockRestore();
  });
});