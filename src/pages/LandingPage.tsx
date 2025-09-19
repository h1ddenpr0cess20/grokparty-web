import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useApiKey } from '@/features/session/apiKey';
import { useUiStore } from '@/state/uiStore';
import { showToast } from '@/state/toastStore';

export default function LandingPage() {
  const navigate = useNavigate();
  const { apiKey, rememberApiKey } = useApiKey();
  const openApiKeyMenu = useUiStore((state) => state.openApiKeyMenu);

  const handleStartSetup = () => {
    if (!apiKey) {
      showToast({
        variant: 'danger',
        title: 'Add your Grok API key',
        description: 'Open the API key menu in the header to connect your account first.',
        durationMs: 4000,
      });
      openApiKeyMenu();
      return;
    }

    navigate('/setup');
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl flex-col items-center gap-16 px-6 py-16 text-center md:py-24">
      <div className="flex flex-col items-center gap-5">
        {/* <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Browser native
        </span> */}
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Host multi-character Grok conversations entirely in your browser.
        </h1>
        <p className="max-w-2xl text-lg text-muted md:text-xl">
          GrokParty Web wraps the Grok API with a friendly interface. Bring your own API key, set
          the roles, stream the banter live, and export transcripts without leaving the browser.
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-6 text-left md:flex-row md:items-stretch">
        <div className="w-full rounded-3xl border border-border bg-surface/80 p-6 shadow-card md:w-3/5">
          <h2 className="text-lg font-semibold text-foreground">Get started</h2>
          <p className="mt-2 text-sm text-muted">
            Manage your API key from the menu in the top right. When you are ready, jump into the
            setup flow to configure the scenario and participants.
          </p>
          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <Button className="w-full md:w-auto" onClick={openApiKeyMenu} variant="secondary">
              Manage API key
            </Button>
            <Button className="w-full md:w-auto" onClick={handleStartSetup}>
              {apiKey ? 'Start configuring' : 'Connect account to begin'}
            </Button>
          </div>
        </div>
        <div className="w-full rounded-3xl border border-dashed border-border/80 bg-surface/60 p-6 text-sm shadow-inner md:w-2/5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">API key status</h3>
          <p className="mt-3 text-base font-semibold text-foreground">
            {apiKey ? 'Key detected' : 'Key not set'}
          </p>
          <p className="mt-2 text-sm text-muted">
            {apiKey
              ? rememberApiKey
                ? 'We will remember this key on this device until you clear it.'
                : 'The key is stored in memory for this session only.'
              : 'Open the API key menu to add your Grok credentials.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 text-left md:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <article key={benefit.title} className="rounded-2xl border border-border bg-surface/60 p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
              {benefit.title}
            </h3>
            <p className="mt-2 text-sm text-muted">{benefit.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const BENEFITS = [
  {
    title: 'No backend services',
    description: 'All traffic goes directly from your browser to Grok using your API key.',
  },
  {
    title: 'Configurable personas',
    description: 'Craft unique characters, set the tone, and fine tune the models for each role.',
  },
  {
    title: 'Live transcript',
    description: 'Watch the conversation unfold in real time and export the transcript afterward.',
  },
];
