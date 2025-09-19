import { useMemo } from 'react';
import { useSessionStore, type ConversationMessage } from './sessionStore';

/**
 * Builds a stable Map of participants by id for fast lookup during rendering.
 */
export function useParticipantsMap() {
  const participants = useSessionStore((state) => state.config.participants);
  return useMemo(() => {
    const map = new Map<string, (typeof participants)[number]>();
    participants.forEach((participant) => {
      map.set(participant.id, participant);
    });
    return map;
  }, [participants]);
}

/**
 * Selects the live conversation messages from the session store.
 */
export function useConversationMessages() {
  return useSessionStore((state) => state.messages);
}

/** Returns the current session status. */
export function useSessionStatus() {
  return useSessionStore((state) => state.status);
}

/** Returns the last error message if any. */
export function useLastError() {
  return useSessionStore((state) => state.lastError);
}

/**
 * React key helper ensuring list items rerender when status transitions.
 */
export function getMessageKey(message: ConversationMessage) {
  return `${message.id}-${message.status}`;
}
