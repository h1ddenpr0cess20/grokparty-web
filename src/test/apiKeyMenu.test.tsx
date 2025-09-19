import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ApiKeyMenu } from '@/components/layout/ApiKeyMenu';
import { ToastViewport } from '@/components/ui/ToastViewport';

describe('ApiKeyMenu', () => {
  it('opens without throwing', () => {
    render(
      <>
        <ApiKeyMenu />
        <ToastViewport />
      </>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();

    const trigger = screen.getByRole('button', { name: /api key/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
