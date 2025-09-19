import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TranscriptActions } from './TranscriptActions';
import { resetSessionStore } from '@/test/testUtils';
import { useSessionStore, createEmptyMessage } from '@/state/sessionStore';

describe('TranscriptActions', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('disables download when there are no messages', () => {
    render(<TranscriptActions />);
    expect(screen.getByRole('button', { name: /download transcript/i })).toBeDisabled();
  });

  it('downloads transcript JSON when messages exist', () => {
    const store = useSessionStore.getState();
    store.appendMessage(
      createEmptyMessage({ id: 'msg-1', speakerId: 'p1', content: 'Hello there', status: 'completed' }),
    );

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const removeSpy = vi.spyOn(HTMLElement.prototype, 'remove').mockImplementation(() => {});

    render(<TranscriptActions />);

    const button = screen.getByRole('button', { name: /download transcript/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
