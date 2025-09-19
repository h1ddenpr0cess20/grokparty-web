import clsx from 'clsx';

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: ReadonlyArray<StepperStep>;
  activeStep: string;
}

export function Stepper({ steps, activeStep }: StepperProps) {
  return (
    <ol className="flex flex-wrap items-center gap-4">
      {steps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isComplete = steps.findIndex((s) => s.id === activeStep) > index;

        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={clsx(
                'flex size-7 items-center justify-center rounded-full border text-xs font-bold',
                isActive && 'border-primary bg-primary text-white',
                !isActive && isComplete && 'border-success bg-success text-white',
                !isActive && !isComplete && 'border-border bg-surface text-muted',
              )}
            >
              {index + 1}
            </span>
            <span
              className={clsx(
                'text-sm font-medium',
                isActive ? 'text-primary' : isComplete ? 'text-success' : 'text-muted',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
