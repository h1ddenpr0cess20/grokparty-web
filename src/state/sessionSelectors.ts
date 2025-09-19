import { useMemo } from 'react';
import { useSessionStore, type ConversationMessage } from './sessionStore';

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

export function useConversationMessages() {
  return useSessionStore((state) => state.messages);
}

export function useSessionStatus() {
  return useSessionStore((state) => state.status);
}

export function useLastError() {
  return useSessionStore((state) => state.lastError);
}

export function getMessageKey(message: ConversationMessage) {
  return `${message.id}-${message.status}`;
}
