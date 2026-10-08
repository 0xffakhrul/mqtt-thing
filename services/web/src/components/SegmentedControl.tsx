type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

export const SegmentedControl = <T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) => (
  <fieldset className="segmented">
    <legend className="visually-hidden">{label}</legend>
    {options.map((option) => (
      <button
        key={option}
        type="button"
        aria-pressed={option === value}
        className={option === value ? 'segment segment-active' : 'segment'}
        onClick={() => onChange(option)}
      >
        {option}
      </button>
    ))}
  </fieldset>
);
