import { RouterProvider } from 'react-router-dom';
import { ToastViewport } from '@/components/ui/ToastViewport';
import { AppProviders } from './AppProviders';
import { AppErrorBoundary } from './AppErrorBoundary';
import { appRouter } from './router';

/** Root application component wiring providers, router and global UI. */
export default function App() {
  return (
    <AppProviders>
      <AppErrorBoundary>
        <RouterProvider router={appRouter} />
        <ToastViewport />
      </AppErrorBoundary>
    </AppProviders>
  );
}
