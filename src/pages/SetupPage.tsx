import { Link } from 'react-router-dom';
import { SetupWizard } from '@/features/setup/SetupWizard';
import { useApiKey } from '@/features/session/apiKey';

/** Standalone page hosting the multi-step setup wizard. */
export default function SetupPage() {
  const { apiKey } = useApiKey();

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Setup</p>
        <h1 className="text-3xl font-semibold text-foreground">Configure your GrokParty</h1>
        <p className="text-base text-muted">
          Choose conversation details, participants, and models. Save the configuration to launch
          the conversation.
        </p>
      </header>

      {apiKey ? (
        <SetupWizard />
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-warning/60 bg-warning/10 p-6 text-sm text-foreground">
          <p>
            Add your Grok API key on the home screen before configuring a session. Once the key is
            set, revisit this page to finish setup.
          </p>
          <Link
            to="/"
            className="inline-flex w-fit items-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-surface/60"
          >
            Return home
          </Link>
        </div>
      )}
    </section>
  );
}
