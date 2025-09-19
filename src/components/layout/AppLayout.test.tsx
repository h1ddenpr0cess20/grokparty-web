import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { resetSessionStore } from '@/test/testUtils';
import { useSessionStore } from '@/state/sessionStore';

describe('AppLayout', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('reflects the session status in the status pill', () => {
    useSessionStore.setState({ status: 'streaming' });

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<div>Home</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('session-status')).toHaveTextContent('Streaming');
  });
});
