import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm, type FieldArrayWithId, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import { useGrokModels } from './useGrokModels';
import { PARTICIPANT_COLORS, useSessionStore, type ConversationConfig } from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

const PARTICIPANT_SCHEMA = z.object({
  id: z.string().min(1),
  persona: z.string().min(1, 'Persona is required'),
  model: z.string().min(1, 'Model selection is required'),
});

const WIZARD_SCHEMA = z.object({
  conversationType: z.string().min(1, 'Pick a conversation type'),
  topic: z.string().trim(),
  setting: z.string().trim(),
  mood: z.string().min(1, 'Mood is required'),
  temperature: z.number().min(0).max(2),
  enableSearch: z.boolean(),
  decisionModel: z.string().min(1, 'Choose a decision model'),
  participants: z.array(PARTICIPANT_SCHEMA).min(2, 'At least two participants are required'),
});

const STEP_SEQUENCE = [
  { id: 'scenario', label: 'Scenario' },
  { id: 'participants', label: 'Participants' },
  { id: 'review', label: 'Launch' },
] as const;

type WizardValues = z.infer<typeof WIZARD_SCHEMA>;

type StepId = (typeof STEP_SEQUENCE)[number]['id'];

const DEFAULT_TYPES = [
  'conversation',
  'debate',
  'argument',
  'meeting',
  'brainstorming',
  'lighthearted',
  'joking',
  'therapy',
];

const DEFAULT_MOODS = ['friendly', 'serious', 'chaotic', 'thoughtful', 'playful'];

interface SetupWizardProps {
  /** Called after saving configuration and navigating to the conversation page. */
  onCompleted?: () => void;
}

/**
 * Multi-step form for configuring a GrokParty session.
 * Persists values into the session store and normalizes participants before launch.
 */
export function SetupWizard({ onCompleted }: SetupWizardProps) {
  const navigate = useNavigate();
  const config = useSessionStore((state) => state.config);
  const updateConfig = useSessionStore((state) => state.updateConfig);
  const setParticipants = useSessionStore((state) => state.setParticipants);
  const [activeStep, setActiveStep] = useState<StepId>('scenario');
  const { models, status: modelsStatus, refresh } = useGrokModels();

  const form = useForm<WizardValues>({
    resolver: zodResolver(WIZARD_SCHEMA),
    mode: 'onBlur',
    defaultValues: mapConfigToForm(config),
  });

  const { fields: participantFields, append, remove } = useFieldArray({
    control: form.control,
    name: 'participants',
  });

  const currentIndex = STEP_SEQUENCE.findIndex((step) => step.id === activeStep);

  const goNext = async () => {
    const fieldsToValidate = stepFieldMap[activeStep];
    const valid = await form.trigger(fieldsToValidate);
    if (!valid) {
      return;
    }

    const nextStep = STEP_SEQUENCE[currentIndex + 1];
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  };

  const goPrevious = () => {
    const prevStep = STEP_SEQUENCE[currentIndex - 1];
    if (prevStep) {
      setActiveStep(prevStep.id);
    }
  };

  const handleSubmit = form.handleSubmit((values) => {
    const topic = values.topic || 'anything';
    const setting = values.setting || 'anywhere';

    updateConfig({
      conversationType: values.conversationType,
      topic,
      setting,
      mood: values.mood,
      temperature: values.temperature,
      enableSearch: values.enableSearch,
      decisionModel: values.decisionModel,
    });
    const normalizedParticipants = values.participants.map((participant) => ({
      id: participant.id,
      persona: participant.persona.trim(),
      model: participant.model,
    }));
    setParticipants(normalizedParticipants);
    showToast({
      variant: 'success',
      title: 'Configuration saved',
      description: 'Your GrokParty setup is ready to launch.',
      durationMs: 4000,
    });
    onCompleted?.();
    navigate('/conversation');
  });

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <Stepper steps={STEP_SEQUENCE} activeStep={activeStep} />
      {activeStep === 'scenario' ? <ScenarioStep form={form} /> : null}
      {activeStep === 'participants' ? (
        <ParticipantsStep
          form={form}
          fields={participantFields}
          models={models}
          modelsStatus={modelsStatus}
          onAdd={() => append(createEmptyParticipant(form.getValues('decisionModel')))}
          onRemove={(index) => remove(index)}
          onRefreshModels={refresh}
        />
      ) : null}
      {activeStep === 'review' ? (
        <ReviewStep values={form.watch()} models={models} />
      ) : null}
      <footer className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {currentIndex > 0 ? (
            <Button variant="ghost" type="button" onClick={goPrevious}>
              Back
            </Button>
          ) : null}
          {activeStep !== 'review' ? (
            <Button variant="primary" type="button" onClick={goNext}>
              Continue
            </Button>
          ) : null}
        </div>
        {activeStep === 'review' ? <Button type="submit">Start Conversation</Button> : null}
      </footer>
    </form>
  );
}

const stepFieldMap: Record<StepId, (keyof WizardValues)[]> = {
  scenario: ['conversationType', 'mood', 'temperature', 'enableSearch'],
  participants: ['participants', 'decisionModel'],
  review: [],
};

interface ScenarioStepProps {
  form: UseFormReturn<WizardValues>;
}

function ScenarioStep({ form }: ScenarioStepProps) {
  const {
    register,
    control,
    formState: { errors },
    watch,
  } = form;
  const temperatureField = register('temperature', { valueAsNumber: true });
  const temperatureValue = watch('temperature') ?? 0.8;

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <FormField label="Conversation type" required error={errors.conversationType?.message}>
        <select
          {...register('conversationType')}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
        >
          {DEFAULT_TYPES.map((type) => (
            <option key={type} value={type}>
              {capitalize(type)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Mood" required error={errors.mood?.message}>
        <select
          {...register('mood')}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
        >
          {DEFAULT_MOODS.map((mood) => (
            <option key={mood} value={mood}>
              {capitalize(mood)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Topic"
        description="Optional. Leave blank to let them talk about anything."
        error={errors.topic?.message}
      >
        <Input placeholder="What should they talk about?" {...register('topic')} />
      </FormField>
      <FormField
        label="Setting"
        description="Optional. Leave blank to keep it location agnostic."
        error={errors.setting?.message}
      >
        <Input placeholder="Where is this taking place?" {...register('setting')} />
      </FormField>
      <FormField
        label="Temperature"
        description="Higher values increase creativity."
        error={errors.temperature?.message as string | undefined}
      >
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          {...temperatureField}
          className="w-full"
        />
        <p className="text-sm text-muted">{temperatureValue.toFixed(1)}</p>
      </FormField>
      <Controller
        control={control}
        name="enableSearch"
        render={({ field }) => (
          <FormField label="Web search assistance">
            <Switch
              checked={field.value}
              onClick={() => field.onChange(!field.value)}
              label={field.value ? 'Enabled' : 'Disabled'}
            />
          </FormField>
        )}
      />
    </section>
  );
}

interface ParticipantsStepProps {
  form: UseFormReturn<WizardValues>;
  fields: FieldArrayWithId<WizardValues, 'participants'>[];
  models: ReturnType<typeof useGrokModels>['models'];
  modelsStatus: ReturnType<typeof useGrokModels>['status'];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onRefreshModels: () => Promise<unknown>;
}

function ParticipantsStep({
  form,
  fields,
  models,
  modelsStatus,
  onAdd,
  onRemove,
  onRefreshModels,
}: ParticipantsStepProps) {
  const {
    register,
    formState: { errors },
  } = form;
  const decisionField = register('decisionModel');
  const modelOptions = useMemo(() => models.map((m) => ({ value: m.id, label: m.name ?? m.id })), [models]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormField
          label="Decision model"
          required
          className="min-w-[220px] flex-1"
          error={errors.decisionModel?.message}
        >
          <select
            {...decisionField}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <Button variant="ghost" type="button" onClick={() => onRefreshModels()}>
          {modelsStatus === 'loading' ? 'Refreshing…' : 'Refresh models'}
        </Button>
      </div>
      {modelsStatus === 'error' ? (
        <p className="text-sm text-warning">
          Unable to reach the Grok API right now. Showing a fallback model list.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const participantErrors = errors.participants?.[index];
          return (
            <div key={field.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Participant {index + 1}
                </h3>
                {fields.length > 2 ? (
                  <Button variant="ghost" type="button" onClick={() => onRemove(index)}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField
                  label="Persona prompt"
                  required
                  error={participantErrors?.persona?.message}
                >
                  <Input {...register(`participants.${index}.persona` as const)} />
                </FormField>
                <FormField label="Model" required error={participantErrors?.model?.message}>
                  <select
                    {...register(`participants.${index}.model` as const)}
                    className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
                  >
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>
          );
        })}
      </div>

      <Button variant="secondary" type="button" onClick={onAdd}>
        Add participant
      </Button>
    </section>
  );
}

interface ReviewStepProps {
  values: WizardValues;
  models: ReturnType<typeof useGrokModels>['models'];
}

function ReviewStep({ values, models }: ReviewStepProps) {
  const modelDescriptions = Object.fromEntries(models.map((model) => [model.id, model]));
  const topicDisplay = values.topic || 'anything';
  const settingDisplay = values.setting || 'anywhere';
  return (
    <section className="grid gap-6 md:grid-cols-2">
      <ReviewCard title="Scenario">
        <dl className="space-y-1 text-sm text-muted">
          <div>
            <dt className="font-semibold text-foreground">Type</dt>
            <dd>{capitalize(values.conversationType)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Topic</dt>
            <dd>{topicDisplay}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Setting</dt>
            <dd>{settingDisplay}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Mood</dt>
            <dd>{capitalize(values.mood)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Temperature</dt>
            <dd>{values.temperature.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Search</dt>
            <dd>{values.enableSearch ? 'Enabled' : 'Disabled'}</dd>
          </div>
        </dl>
      </ReviewCard>
      <ReviewCard title="Participants">
        <ul className="space-y-3 text-sm text-muted">
          {values.participants.map((participant, index) => {
            const color = PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
            const displayName = deriveDisplayName(participant.persona, index);

            return (
              <li key={participant.id} className="flex items-start gap-3">
                <span
                  className="mt-1 inline-flex size-3 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <div>
                  <p className="font-semibold text-foreground">{displayName}</p>
                  <p>{participant.persona || 'No persona provided yet.'}</p>
                  <p className="text-xs text-muted">
                    {modelDescriptions[participant.model]?.name ?? participant.model}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </ReviewCard>
      <ReviewCard title="Decision model" className="md:col-span-2">
        <p className="text-sm text-muted">
          {modelDescriptions[values.decisionModel]?.name ?? values.decisionModel}
        </p>
        {modelDescriptions[values.decisionModel]?.description ? (
          <p className="mt-2 text-sm text-muted">
            {modelDescriptions[values.decisionModel]?.description}
          </p>
        ) : null}
      </ReviewCard>
    </section>
  );
}

function ReviewCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`rounded-2xl border border-border bg-surface p-5 shadow-sm ${className ?? ''}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </article>
  );
}

function mapConfigToForm(config: ConversationConfig): WizardValues {
  const decisionModel = config.decisionModel ?? 'grok-4';
  const topic = config.topic?.trim() ?? '';
  const setting = config.setting?.trim() ?? '';
  const participants = (config.participants.length
    ? config.participants
    : [createEmptyParticipant(decisionModel), createEmptyParticipant(decisionModel)]
  ).map((participant) => ({
    id: participant.id,
    persona: participant.persona,
    model: participant.model || decisionModel,
  }));

  while (participants.length < 2) {
    participants.push(createEmptyParticipant(decisionModel));
  }

  return {
    conversationType: config.conversationType ?? 'conversation',
    topic: topic && topic.toLowerCase() !== 'anything' ? topic : '',
    setting: setting && setting.toLowerCase() !== 'anywhere' ? setting : '',
    mood: config.mood ?? 'friendly',
    temperature: config.temperature ?? 0.8,
    enableSearch: config.enableSearch ?? true,
    decisionModel,
    participants,
  };
}

function createEmptyParticipant(defaultModel: string | undefined): WizardValues['participants'][number] {
  return {
    id: createId(),
    persona: '',
    model: defaultModel ?? 'grok-4',
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function deriveDisplayName(persona: string, index: number): string {
  if (!persona) {
    return `Character ${index + 1}`;
  }

  const primary = persona.split(/[.!?\n\r]/)[0]?.trim() ?? persona;
  const cleaned = primary.replace(/^[^A-Za-z0-9]+/, '').trim();

  if (!cleaned) {
    return `Character ${index + 1}`;
  }

  return cleaned.length > 36 ? `${cleaned.slice(0, 33).trimEnd()}…` : cleaned;
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
