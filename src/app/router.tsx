import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import ConversationPage from '@/pages/ConversationPage';
import LandingPage from '@/pages/LandingPage';
import NotFoundPage from '@/pages/NotFoundPage';
import SetupPage from '@/pages/SetupPage';

export const appRouter = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppLayout />}>
      <Route index element={<LandingPage />} />
      <Route path="setup" element={<SetupPage />} />
      <Route path="conversation" element={<ConversationPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>,
  ),
);
