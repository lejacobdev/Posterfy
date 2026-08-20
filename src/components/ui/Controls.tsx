/**
 * Form controls used throughout the editor.
 *
 * All of them are sized for touch first (44px minimum targets), labelled for
 * screen readers, and keyboard operable.
 */

import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils/misc';
import { Icon, type IconName } from './Icon';
import './Controls.css';

/* Switch ---------------------------------------------------------------- */

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  icon?: IconName;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, hint, icon, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className={cn('toggle', disabled && 'toggle--disabled')}>
      <label className="toggle__label" htmlFor={id}>
        {icon && <Icon name={icon} size={16} className="toggle__icon" />}
        <span className="toggle__text">
          {label}
          {hint && <span className="toggle__hint">{hint}</span>}
        </span>
      </label>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={cn('switch', checked && 'switch--on')}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </div>
  );
}

/* Slider ---------------------------------------------------------------- */

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Formats the value shown next to the label. */
  format?: (value: number) => string;
  icon?: IconName;
}

export function Slider({ label, value, min, max, step = 1, onChange, format, icon }: SliderProps) {
  const id = useId();
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="slider">
      <div className="slider__head">
        <label className="slider__label" htmlFor={id}>
          {icon && <Icon name={icon} size={15} />}
          {label}
        </label>
        <output className="slider__value" htmlFor={id}>
          {format ? format(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        // The filled portion of the track is drawn from this custom property.
        style={{ '--fill': `${percent}%` } as React.CSSProperties}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

/* Colour field ----------------------------------------------------------- */

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ColorField({ label, value, onChange, disabled }: ColorFieldProps) {
  const id = useId();
  // The text field keeps its own draft so half-typed values survive a render;
  // only a complete hex value is pushed upstream.
  const [draft, setDraft] = useState(value.toUpperCase());

  useEffect(() => {
    setDraft(value.toUpperCase());
  }, [value]);

  const commit = (raw: string) => {
    const next = raw.trim();
    if (/^#?[\da-f]{6}$/i.test(next)) {
      onChange(next.startsWith('#') ? next.toLowerCase() : `#${next.toLowerCase()}`);
      return true;
    }
    return false;
  };

  return (
    <div className={cn('color-field', disabled && 'color-field--disabled')}>
      <label className="color-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="color-field__control">
        <input
          id={id}
          type="color"
          className="color-field__swatch"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          className="color-field__hex input"
          value={draft}
          disabled={disabled}
          spellCheck={false}
          maxLength={7}
          aria-label={`${label} hex value`}
          onChange={(event) => {
            setDraft(event.target.value);
            commit(event.target.value);
          }}
          onBlur={() => {
            // Discard anything that never became a valid colour.
            if (!commit(draft)) setDraft(value.toUpperCase());
          }}
        />
      </div>
    </div>
  );
}

/* Segmented control ------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Wraps to multiple rows instead of scrolling horizontally. */
  wrap?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  wrap,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      <div className={cn('segmented__track', wrap && 'segmented__track--wrap')}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={cn('segmented__option', value === option.value && 'is-active')}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <Icon name={option.icon} size={15} />}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Text field ------------------------------------------------------------- */

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  type?: 'text' | 'password';
  multiline?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength,
  type = 'text',
  multiline,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="textarea"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          className="input"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={type === 'password' ? 'off' : undefined}
          spellCheck={type === 'password' ? false : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

/* Collapsible section ---------------------------------------------------- */

export interface PanelSectionProps {
  title: string;
  icon?: IconName;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

export function PanelSection({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
}: PanelSectionProps) {
  return (
    <details className="panel-section" open={defaultOpen}>
      <summary className="panel-section__summary">
        {icon && <Icon name={icon} size={17} className="panel-section__icon" />}
        <span className="panel-section__title">{title}</span>
        {badge && <span className="panel-section__badge">{badge}</span>}
        <Icon name="chevronDown" size={18} className="panel-section__chevron" />
      </summary>
      <div className="panel-section__body">{children}</div>
    </details>
  );
}
