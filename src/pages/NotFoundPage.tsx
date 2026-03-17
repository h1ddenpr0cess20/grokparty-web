import { Link } from 'react-router-dom';

/** Generic 404 page. */
export default function NotFoundPage() {
  return (
    <section className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-foreground text-4xl font-semibold">Page not found</h1>
      <p className="text-muted max-w-lg">
        The page you are looking for has moved or no longer exists.
      </p>
      <Link
        to="/"
        className="bg-primary shadow-card inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Return home
      </Link>
    </section>
  );
}
