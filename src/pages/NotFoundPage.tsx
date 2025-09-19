import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-4xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-lg text-muted">
        The page you are looking for has moved or no longer exists.
      </p>
      <Link
        to="/"
        className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:opacity-90"
      >
        Return home
      </Link>
    </section>
  );
}
