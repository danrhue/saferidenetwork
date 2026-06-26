'use client';

import OperatingStatesStep, {
  type OperatingStatesSaveResult,
} from '@/components/driver/OperatingStatesStep';

type DrivingStatesSettingsProps = {
  initialStates?: string[];
  onSaved?: (states: string[]) => void | Promise<void>;
  compact?: boolean;
};

/** Settings card wrapper — delegates to the shared Operating States step. */
export default function DrivingStatesSettings({
  initialStates = [],
  onSaved,
  compact = false,
}: DrivingStatesSettingsProps) {
  const handleSaved = async (result: OperatingStatesSaveResult) => {
    await onSaved?.(result.drivingStates);
  };

  return (
    <OperatingStatesStep
      initialStates={initialStates}
      onSaved={handleSaved}
      variant={compact ? 'wizard' : 'card'}
    />
  );
}