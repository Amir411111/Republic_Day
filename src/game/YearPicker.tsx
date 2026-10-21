import { useI18n } from '../i18n';
import { YEAR_MAX, YEAR_MIN } from './scoring';

interface Props {
  value: number;
  onChange: (y: number) => void;
  // the game's range by default; the quest asks within a narrower one
  min?: number;
  max?: number;
  label?: string;
  id?: string;
}

// Slider for the coarse choice, ±1/±10 buttons for a precise one without fine motor control
export default function YearPicker({
  value,
  onChange,
  min = YEAR_MIN,
  max = YEAR_MAX,
  label,
  id = 'year-slider',
}: Props) {
  const { t } = useI18n();
  const clamp = (y: number) => Math.min(max, Math.max(min, y));
  // feeds the CSS gradient so the filled part of the track follows the thumb
  const fill = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {label ?? t('whatYear')}
        </label>
        <output htmlFor={id} className="font-display text-3xl font-bold text-primary tabular-nums">
          {value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="year-slider"
        style={{ ['--fill' as string]: `${fill}%` }}
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1 grid grid-cols-4 gap-2">
        {[-10, -1, 1, 10].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(clamp(value + d))}
            className="min-h-12 rounded-xl border border-border/80 bg-card/60 text-base font-semibold tabular-nums transition-colors hover:bg-accent"
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </div>
  );
}
