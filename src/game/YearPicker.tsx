import { useI18n } from '../i18n';
import { YEAR_MAX, YEAR_MIN } from './scoring';

interface Props {
  value: number;
  onChange: (y: number) => void;
}

const clamp = (y: number) => Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));

// Slider for the coarse choice, ±1/±10 buttons for a precise one without fine motor control
export default function YearPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  // feeds the CSS gradient so the filled part of the track follows the thumb
  const fill = ((value - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100;

  return (
    <div className="w-full min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <label htmlFor="year-slider" className="text-sm text-muted-foreground">
          {t('whatYear')}
        </label>
        <output htmlFor="year-slider" className="font-display text-3xl font-bold text-primary tabular-nums">
          {value}
        </output>
      </div>
      <input
        id="year-slider"
        type="range"
        className="year-slider"
        style={{ ['--fill' as string]: `${fill}%` }}
        min={YEAR_MIN}
        max={YEAR_MAX}
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
