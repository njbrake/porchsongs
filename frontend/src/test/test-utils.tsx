import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import type { ReactElement, ReactNode } from 'react';

interface RouterRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

/**
 * Render helper that wraps components in MemoryRouter + HelmetProvider.
 * Use this for any component that uses React Router hooks or Helmet.
 */
export function renderWithRouter(ui: ReactElement, { route = '/', ...options }: RouterRenderOptions = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HelmetProvider>
        <MemoryRouter initialEntries={[route]}>
          {children}
        </MemoryRouter>
      </HelmetProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
