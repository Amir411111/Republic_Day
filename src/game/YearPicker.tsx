import { YEAR_MAX, YEAR_MIN } from './scoring';

interface Props {
  value: number;
  onChange: (y: number) => void;
  label: string;
}

const clamp = (y: number) => Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));

// Slider for coarse choice, ±1/±10 buttons for precise choice without fine motor control
export default function YearPicker({ value, onChange, label }: Props) {
  return (
    <div className="year-picker">
      <label htmlFor="year">
        {label} <strong className="year-value">{value}</strong>
      </label>
      <input
        id="year"
        type="range"
        min={YEAR_MIN}
        max={YEAR_MAX}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="year-steps">
        {[-10, -1, 1, 10].map((d) => (
          <button key={d} type="button" onClick={() => onChange(clamp(value + d))}>
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </div>
  );
}
