import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/public/NotFound';
import UnauthorizedPage from '@/pages/public/Unauthorized';
import ErrorBoundary from '@/components/common/ErrorBoundary';

describe('Frontend 404 Page Not Found', () => {
  it('renders the 404 heading, message, Go home, Contact us and popular links', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByRole('img', { name: /Error 404/i })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: /We can't find that page/i })).toBeDefined();
    expect(screen.getByText(/The page you are looking for may have moved or doesn't exist/i)).toBeDefined();

    expect(screen.getByRole('link', { name: /Go home/i }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: /Contact us/i }).getAttribute('href')).toBe('/contact');

    const popular = screen.getByRole('navigation', { name: /Helpful links/i });
    expect(popular.querySelector('a[href="/services"]')).not.toBeNull();
    expect(popular.querySelector('a[href="/about"]')).not.toBeNull();
  });
});

describe('Frontend 403 Unauthorized Page', () => {
  it('renders the 403 status, heading, Go home and Contact support links', () => {
    render(
      <MemoryRouter>
        <UnauthorizedPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Error 403/i)).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: /You don't have access to this page/i })).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();

    expect(screen.getByRole('link', { name: /Go home/i }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: /Contact support/i }).getAttribute('href')).toBe('/contact');
  });
});

describe('Global ErrorBoundary', () => {
  const Bomb: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
      throw new Error('Explosion during render!');
    }
    return <div>Normal component content</div>;
  };

  it('catches render errors and renders generic safe fallback UI with Try Again and Go Home', async () => {
    const user = userEvent.setup();
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => {});

    const TestContainer = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      return (
        <div>
          <button type="button" onClick={() => setShouldThrow(false)}>
            Disarm Bomb
          </button>
          <ErrorBoundary>
            <Bomb shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </div>
      );
    };

    render(<TestContainer />);

    expect(screen.getByRole('heading', { name: /Something went wrong. Please try again./i })).toBeDefined();
    expect(screen.queryByText(/Explosion during render!/i)).toBeNull();

    const tryAgainBtn = screen.getByRole('button', { name: /Try Again/i });
    const goHomeBtn = screen.getByRole('button', { name: /Go Home/i });
    expect(tryAgainBtn).toBeDefined();
    expect(goHomeBtn).toBeDefined();

    // Disarm the bomb first, then click Try Again
    await user.click(screen.getByRole('button', { name: /Disarm Bomb/i }));
    await user.click(tryAgainBtn);

    expect(screen.getByText(/Normal component content/i)).toBeDefined();

    spyConsole.mockRestore();
  });
});
