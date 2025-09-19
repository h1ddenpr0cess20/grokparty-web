import { Component, type ErrorInfo, type ReactNode } from 'react';
import { showToast } from '@/state/toastStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches unhandled React errors to keep the app usable and inform the user.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in GrokParty Web', error, info);
    showToast({
      variant: 'danger',
      title: 'Something went wrong',
      description: error.message || 'An unexpected error occurred.',
      durationMs: 10000,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
          <h1 className="text-3xl font-semibold text-danger">We ran into a problem.</h1>
          <p className="mt-2 max-w-xl text-muted">
            Try refreshing the page. If the issue persists, please file a bug with the steps you took.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
