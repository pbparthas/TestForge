/**
 * SessionWizard Component
 * 5-step wizard for CodeGuardian sessions: Setup → Files → Functions → Generate → Export
 */

import { cn } from '../../utils/cn';
import { Check, Settings, Upload, FolderTree, Zap, Download } from 'lucide-react';

export type WizardStep = 'setup' | 'files' | 'functions' | 'generate' | 'export';

interface SessionWizardProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  completedSteps: WizardStep[];
  disabled?: boolean;
}

const steps: { id: WizardStep; label: string; description: string; icon: typeof Settings }[] = [
  { id: 'setup', label: 'Setup', description: 'Language & Framework', icon: Settings },
  { id: 'files', label: 'Files', description: 'Upload source files', icon: Upload },
  { id: 'functions', label: 'Functions', description: 'Select functions', icon: FolderTree },
  { id: 'generate', label: 'Generate', description: 'Create tests', icon: Zap },
  { id: 'export', label: 'Export', description: 'Save tests', icon: Download },
];

export function SessionWizard({ currentStep, onStepClick, completedSteps, disabled }: SessionWizardProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="w-full">
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = step.id === currentStep;
            const isClickable = !disabled && (isCompleted || index <= currentIndex);
            const Icon = step.icon;

            return (
              <li key={step.id} className={cn('relative', index !== steps.length - 1 && 'flex-1')}>
                <div className="flex items-center">
                  {/* Step Circle */}
                  <button
                    onClick={() => isClickable && onStepClick?.(step.id)}
                    disabled={!isClickable}
                    className={cn(
                      'relative flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                      isCompleted && 'bg-green-600 hover:bg-green-700',
                      isCurrent && !isCompleted && 'border-2 border-green-600 bg-white',
                      !isCurrent && !isCompleted && 'border-2 border-gray-300 bg-white',
                      isClickable && 'cursor-pointer',
                      !isClickable && 'cursor-default'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <Icon className={cn(
                        'h-5 w-5',
                        isCurrent ? 'text-green-600' : 'text-gray-400'
                      )} />
                    )}
                  </button>

                  {/* Connector Line */}
                  {index !== steps.length - 1 && (
                    <div
                      className={cn(
                        'ml-2 h-0.5 flex-1 mr-2',
                        isCompleted ? 'bg-green-600' : 'bg-gray-300'
                      )}
                    />
                  )}
                </div>

                {/* Step Label (below circle) */}
                <div className="absolute -bottom-8 left-0 w-24 -translate-x-1/4">
                  <p className={cn(
                    'text-xs font-medium text-center',
                    isCurrent ? 'text-green-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                  )}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-gray-400 text-center truncate">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

interface WizardNavigationProps {
  currentStep: WizardStep;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  isGenerating?: boolean;
  isExporting?: boolean;
}

export function WizardNavigation({
  currentStep,
  onBack,
  onContinue,
  canContinue,
  isGenerating,
  isExporting,
}: WizardNavigationProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;

  const getContinueLabel = () => {
    if (currentStep === 'generate') return isGenerating ? 'Generating...' : 'Generate Tests';
    if (currentStep === 'export') return isExporting ? 'Exporting...' : 'Export Tests';
    return 'Continue';
  };

  return (
    <div className="flex items-center justify-between pt-6 border-t border-gray-200">
      <button
        onClick={onBack}
        disabled={isFirstStep}
        className={cn(
          'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
          isFirstStep
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        ← Back
      </button>

      <button
        onClick={onContinue}
        disabled={!canContinue || isGenerating || isExporting}
        className={cn(
          'flex items-center gap-2 px-6 py-2 text-sm font-medium rounded-lg transition-colors',
          canContinue && !isGenerating && !isExporting
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        )}
      >
        {(isGenerating || isExporting) && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {getContinueLabel()} {!isLastStep && !isGenerating && '→'}
      </button>
    </div>
  );
}

export function getNextStep(current: WizardStep): WizardStep | null {
  const currentIndex = steps.findIndex(s => s.id === current);
  const nextStep = steps[currentIndex + 1];
  if (currentIndex >= 0 && currentIndex < steps.length - 1 && nextStep) {
    return nextStep.id;
  }
  return null;
}

export function getPreviousStep(current: WizardStep): WizardStep | null {
  const currentIndex = steps.findIndex(s => s.id === current);
  const prevStep = steps[currentIndex - 1];
  if (currentIndex > 0 && prevStep) {
    return prevStep.id;
  }
  return null;
}
