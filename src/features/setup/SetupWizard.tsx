import clsx from 'clsx';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  type FieldArrayWithId,
  type UseFormReturn,
  type Resolver,
} from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import { useGrokModels } from './useGrokModels';
import {
  useSessionStore,
  type ConversationConfig,
  type Participant,
  type ParticipantInput,
  type ParticipantMcpAccess,
  type McpServerConfig,
  DEFAULT_PARTICIPANT_TEMPERATURE,
  DEFAULT_PARTICIPANT_ENABLE_SEARCH,
  DEFAULT_PARTICIPANT_ENABLE_CODE_INTERPRETER,
  DEFAULT_PARTICIPANT_ENABLE_X_SEARCH_TOOL,
} from '@/state/sessionStore';
import { showToast } from '@/state/toastStore';

type ParticipantFormValues = {
  id: string;
  persona: string;
  model: string;
  temperature: number;
  enableSearch: boolean;
  enableCodeInterpreter: boolean;
  enableXSearchTool: boolean;
  mcpAccess: Array<{
    serverId: string;
    allowedToolNames: string[];
  }>;
};

type WizardValues = {
  conversationType: string;
  topic: string;
  setting: string;
  mood: string;
  userName?: string;
  decisionModel: string;
  participants: ParticipantFormValues[];
};

const PARTICIPANT_SCHEMA: z.ZodType<ParticipantFormValues> = z.object({
  id: z.string().min(1),
  persona: z.string().min(1, 'Persona is required'),
  model: z.string().min(1, 'Model selection is required'),
  temperature: z.number().min(0).max(2),
  enableSearch: z.boolean(),
  enableCodeInterpreter: z.boolean(),
  enableXSearchTool: z.boolean(),
  mcpAccess: z
    .array(
      z.object({
        serverId: z.string().min(1),
        allowedToolNames: z.array(z.string().trim().min(1)).default([]),
      }),
    )
    .default([]),
});

const WIZARD_SCHEMA: z.ZodType<WizardValues> = z.object({
  conversationType: z.string().min(1, 'Pick a conversation type'),
  topic: z.string().trim(),
  setting: z.string().trim(),
  mood: z.string().min(1, 'Mood is required'),
  userName: z.string().trim().max(48).optional(),
  decisionModel: z.string().min(1, 'Choose a decision model'),
  participants: z.array(PARTICIPANT_SCHEMA).min(2, 'At least two participants are required'),
});

const WIZARD_RESOLVER = zodResolver(WIZARD_SCHEMA as any) as Resolver<WizardValues, undefined, WizardValues>;

const STEP_SEQUENCE = [
  { id: 'scenario', label: 'Scenario' },
  { id: 'participants', label: 'Participants' },
] as const;

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

const DEFAULT_MOODS = ['friendly', 'serious', 'chaotic', 'thoughtful', 'playful', 'hostile'];

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
  const availableServers = config.mcpServers ?? [];
  const updateConfig = useSessionStore((state) => state.updateConfig);
  const setParticipants = useSessionStore((state) => state.setParticipants);
  const resetSession = useSessionStore((state) => state.resetSession);
  const [activeStep, setActiveStep] = useState<StepId>('scenario');
  const { models, status: modelsStatus, refresh } = useGrokModels();

  const form = useForm<WizardValues, undefined, WizardValues>({
    resolver: WIZARD_RESOLVER,
    mode: 'onBlur',
    defaultValues: mapConfigToForm(config),
  });

  const { fields: participantFields, append: appendParticipant, remove: removeParticipant } = useFieldArray({
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
      userName: values.userName?.trim() || '',
      decisionModel: values.decisionModel,
    });
    const normalizedParticipants: ParticipantInput[] = values.participants.map((participant) => {
      const normalizedAccess: ParticipantMcpAccess[] = participant.mcpAccess.map((access) => ({
        serverId: access.serverId,
        allowedToolNames: access.allowedToolNames.map((toolName) => toolName.trim()).filter(Boolean),
      }));

      return {
        id: participant.id,
        persona: participant.persona.trim(),
        model: participant.model,
        temperature: participant.temperature,
        enableSearch: participant.enableSearch,
        enableCodeInterpreter: participant.enableCodeInterpreter,
        enableXSearchTool: participant.enableXSearchTool,
        mcpAccess: normalizedAccess,
      };
    });
    setParticipants(normalizedParticipants);
    resetSession();
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
          availableServers={availableServers}
          models={models}
          modelsStatus={modelsStatus}
          onAdd={() => appendParticipant(createEmptyParticipant(form.getValues('decisionModel')))}
          onRemove={(index) => removeParticipant(index)}
          onRefreshModels={refresh}
        />
      ) : null}
      <footer className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {currentIndex > 0 ? (
            <Button variant="ghost" type="button" onClick={goPrevious}>
              Back
            </Button>
          ) : null}
          {activeStep !== 'participants' ? (
            <Button variant="primary" type="button" onClick={goNext}>
              Continue
            </Button>
          ) : null}
        </div>
        {activeStep === 'participants' ? (
          <Button type="submit">Save &amp; go to conversation</Button>
        ) : null}
      </footer>
    </form>
  );
}

const stepFieldMap: Record<StepId, (keyof WizardValues)[]> = {
  scenario: ['conversationType', 'mood', 'userName'],
  participants: ['participants', 'decisionModel'],
};

type WizardFormReturn = UseFormReturn<WizardValues, undefined, WizardValues>;

interface ScenarioStepProps {
  form: WizardFormReturn;
}

function ScenarioStep({ form }: ScenarioStepProps) {
  const {
    register,
    formState: { errors },
  } = form;

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
      <>
        <FormField
          label="Your name"
          description="Optional. Participants will use this when responding to you."
          error={errors.userName?.message}
        >
          <Input
            {...register('userName')}
            maxLength={48}
            placeholder="What should they call you?"
          />
        </FormField>
      </>
    </section>
  );
}

interface ParticipantsStepProps {
  form: WizardFormReturn;
  fields: FieldArrayWithId<WizardValues, 'participants'>[];
  availableServers: McpServerConfig[];
  models: ReturnType<typeof useGrokModels>['models'];
  modelsStatus: ReturnType<typeof useGrokModels>['status'];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onRefreshModels: () => Promise<unknown>;
}

function ParticipantsStep({
  form,
  fields,
  availableServers,
  models,
  modelsStatus,
  onAdd,
  onRemove,
  onRefreshModels,
}: ParticipantsStepProps) {
  const {
    register,
    control,
    formState: { errors },
    watch,
    setValue,
    getValues,
  } = form;
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({});
  const decisionField = register('decisionModel');
  const modelOptions = useMemo(() => models.map((m) => ({ value: m.id, label: m.name ?? m.id })), [models]);

  const togglePanel = (id: string) => {
    setExpandedPanels((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getMcpAccess = (participantIndex: number) =>
    watch(`participants.${participantIndex}.mcpAccess` as const) ?? [];

  useEffect(() => {
    const allowedIds = new Set(availableServers.map((server) => server.id));
    fields.forEach((_, index) => {
      const path = `participants.${index}.mcpAccess` as const;
      const current = getValues(path) ?? [];
      const filtered = current.filter((entry) => allowedIds.has(entry.serverId));
      if (filtered.length !== current.length) {
        setValue(path, filtered, { shouldDirty: true });
      }
    });
  }, [availableServers, fields, getValues, setValue]);

  const toggleServerAccess = (participantIndex: number, serverId: string, hasAccess: boolean) => {
    const path = `participants.${participantIndex}.mcpAccess` as const;
    const current = getValues(path) ?? [];
    const nextValue = hasAccess
      ? current.filter((entry) => entry.serverId !== serverId)
      : [...current, { serverId, allowedToolNames: [] }];
    setValue(path, nextValue, { shouldDirty: true });
  };

  const updateAllowedToolNames = (participantIndex: number, serverId: string, value: string) => {
    const path = `participants.${participantIndex}.mcpAccess` as const;
    const current = getValues(path) ?? [];
    const nextValue = current.map((entry) => {
      if (entry.serverId !== serverId) {
        return entry;
      }
      const parsed = value
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      return { ...entry, allowedToolNames: parsed };
    });
    setValue(path, nextValue, { shouldDirty: true });
  };

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
          const temperatureFieldName = `participants.${index}.temperature` as const;
          const temperatureField = register(temperatureFieldName, { valueAsNumber: true });
          const temperatureValue = form.watch(temperatureFieldName) ?? DEFAULT_PARTICIPANT_TEMPERATURE;
          const participantAccess = getMcpAccess(index);
          const isExpanded = expandedPanels[field.id] ?? false;
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
                  label="Personality (name or brief description)"
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
              <div className="mt-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-border/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-foreground"
                  onClick={() => togglePanel(field.id)}
                >
                  Character settings
                  <ChevronIcon expanded={isExpanded} />
                </button>
                {isExpanded ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-border/80 bg-border/5 p-4">
                    <div className="space-y-4">
                      <FormField
                        label="Creativity (temperature)"
                        description="Higher values increase creativity for this character."
                        error={participantErrors?.temperature?.message as string | undefined}
                      >
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.1}
                          className="w-full"
                          {...temperatureField}
                        />
                        <p className="text-sm text-muted">{temperatureValue.toFixed(1)}</p>
                      </FormField>
                      <Controller
                        control={control}
                        name={`participants.${index}.enableSearch` as const}
                        render={({ field }) => (
                          <FormField
                            label="Web search assistance"
                            description="Allow this character to pull in live information from the web."
                          >
                            <Switch
                              checked={field.value}
                              onClick={() => field.onChange(!field.value)}
                              label={field.value ? 'Enabled' : 'Disabled'}
                            />
                          </FormField>
                        )}
                      />
                      <Controller
                        control={control}
                        name={`participants.${index}.enableXSearchTool` as const}
                        render={({ field }) => (
                          <FormField
                            label="X search tool"
                            description="Allow this character to run X search with image and video understanding."
                          >
                            <Switch
                              checked={field.value}
                              onClick={() => field.onChange(!field.value)}
                              label={field.value ? 'Enabled' : 'Disabled'}
                            />
                          </FormField>
                        )}
                      />
                      <Controller
                        control={control}
                        name={`participants.${index}.enableCodeInterpreter` as const}
                        render={({ field }) => (
                          <FormField
                            label="Code interpreter"
                            description="Allow this character to run code in a sandboxed tool."
                          >
                            <Switch
                              checked={field.value}
                              onClick={() => field.onChange(!field.value)}
                              label={field.value ? 'Enabled' : 'Disabled'}
                            />
                          </FormField>
                        )}
                      />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">MCP access</p>
                        {availableServers.length ? (
                          <div className="space-y-3">
                            {availableServers.map((server) => {
                              if (!server?.id) {
                                return null;
                              }
                              const accessEntry = participantAccess.find((entry) => entry.serverId === server.id);
                              const hasAccess = Boolean(accessEntry);
                              const allowedNames = accessEntry?.allowedToolNames?.join(', ') ?? '';
                              return (
                                <div key={server.id} className="rounded-xl border border-border/70 bg-surface/80 p-3">
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">{server.label || 'Untitled server'}</p>
                                        <p className="break-all text-xs text-muted">{server.url}</p>
                                      </div>
                                      <Switch
                                        checked={hasAccess}
                                        onClick={() => toggleServerAccess(index, server.id, hasAccess)}
                                        label={hasAccess ? 'Enabled' : 'Disabled'}
                                      />
                                    </div>
                                    {hasAccess ? (
                                      <FormField
                                        label="Allowed tool names"
                                        description="Comma-separated list. Leave blank to allow all tools."
                                      >
                                        <Input
                                          value={allowedNames}
                                          placeholder="tool_a, tool_b"
                                          onChange={(event) =>
                                            updateAllowedToolNames(index, server.id, event.target.value)
                                          }
                                        />
                                      </FormField>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted">
                            Configure MCP servers from the header menu to enable tool access.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
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

function mapConfigToForm(config: ConversationConfig): WizardValues {
  const decisionModel = config.decisionModel ?? 'grok-4';
  const topic = config.topic?.trim() ?? '';
  const setting = config.setting?.trim() ?? '';
  const legacyConfig = config as ConversationConfig & { enableSearch?: boolean };
  const legacyEnableSearch =
    typeof legacyConfig.enableSearch === 'boolean'
      ? legacyConfig.enableSearch
      : DEFAULT_PARTICIPANT_ENABLE_SEARCH;
  const participants = (config.participants.length
    ? config.participants
    : [createEmptyParticipant(decisionModel), createEmptyParticipant(decisionModel)]
  ).map((participant) => {
    const partialParticipant = participant as Partial<Participant>;
    return {
      id: participant.id,
      persona: participant.persona,
      model: participant.model || decisionModel,
      temperature: Number.isFinite(partialParticipant.temperature)
        ? (partialParticipant.temperature as number)
        : DEFAULT_PARTICIPANT_TEMPERATURE,
      enableSearch:
        typeof partialParticipant.enableSearch === 'boolean'
          ? partialParticipant.enableSearch
          : legacyEnableSearch,
      enableCodeInterpreter:
        typeof partialParticipant.enableCodeInterpreter === 'boolean'
          ? partialParticipant.enableCodeInterpreter
          : DEFAULT_PARTICIPANT_ENABLE_CODE_INTERPRETER,
      enableXSearchTool:
        typeof partialParticipant.enableXSearchTool === 'boolean'
          ? partialParticipant.enableXSearchTool
          : DEFAULT_PARTICIPANT_ENABLE_X_SEARCH_TOOL,
      mcpAccess: Array.isArray(partialParticipant.mcpAccess)
        ? partialParticipant.mcpAccess.map((access) => ({
            serverId: access.serverId,
            allowedToolNames: Array.isArray(access.allowedToolNames)
              ? access.allowedToolNames
              : [],
          }))
        : [],
    };
  });

  while (participants.length < 2) {
    participants.push(createEmptyParticipant(decisionModel));
  }

  return {
    conversationType: config.conversationType ?? 'conversation',
    topic: topic && topic.toLowerCase() !== 'anything' ? topic : '',
    setting: setting && setting.toLowerCase() !== 'anywhere' ? setting : '',
    mood: config.mood ?? 'friendly',
    userName: config.userName?.trim() ?? '',
    decisionModel,
    participants,
  };
}

function createEmptyParticipant(defaultModel: string | undefined): WizardValues['participants'][number] {
  return {
    id: createId(),
    persona: '',
    model: defaultModel ?? 'grok-4',
    temperature: DEFAULT_PARTICIPANT_TEMPERATURE,
    enableSearch: DEFAULT_PARTICIPANT_ENABLE_SEARCH,
    enableCodeInterpreter: DEFAULT_PARTICIPANT_ENABLE_CODE_INTERPRETER,
    enableXSearchTool: DEFAULT_PARTICIPANT_ENABLE_X_SEARCH_TOOL,
    mcpAccess: [],
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={clsx('size-4 transition-transform', expanded ? 'rotate-180 text-foreground' : 'text-muted')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
