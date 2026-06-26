'use client';

type ShowDeletedToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

export default function ShowDeletedToggle({
  checked,
  onChange,
  label = 'Show Deleted',
}: ShowDeletedToggleProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-950">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
      />
      <span>{label}</span>
    </label>
  );
}