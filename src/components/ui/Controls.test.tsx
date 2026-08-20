import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorField, SegmentedControl, Slider, TextField, Toggle } from './Controls';
import { Icon, ICON_NAMES } from './Icon';

describe('Toggle', () => {
  it('exposes switch semantics', () => {
    render(<Toggle checked={false} onChange={() => undefined} label="Tracklist" />);
    const control = screen.getByRole('switch', { name: 'Tracklist' });
    expect(control).toHaveAttribute('aria-checked', 'false');
  });

  it('reports the new value on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Tracklist" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('cannot be toggled while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="Tracklist" disabled />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Slider', () => {
  it('renders the formatted value', () => {
    render(
      <Slider
        label="Grain"
        value={0.5}
        min={0}
        max={1}
        step={0.1}
        onChange={() => undefined}
        format={(value) => `${Math.round(value * 100)}%`}
      />,
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('emits numbers, not strings', () => {
    const onChange = vi.fn();
    render(<Slider label="Grain" value={2} min={0} max={10} onChange={onChange} />);
    const input = screen.getByLabelText('Grain');
    // Range inputs report strings; the component must convert them.
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
      input,
      '7',
    );
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(7);
  });
});

describe('SegmentedControl', () => {
  it('marks the active option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Format"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('ColorField', () => {
  it('only propagates valid hex values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorField label="Background" value="#000000" onChange={onChange} />);

    const hexInput = screen.getByLabelText('Background hex value');
    await user.clear(hexInput);
    await user.type(hexInput, 'zzz');
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(hexInput);
    await user.type(hexInput, '#ff0000');
    expect(onChange).toHaveBeenCalledWith('#ff0000');
  });
});

describe('TextField', () => {
  it('reports every keystroke', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextField label="Album title" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText('Album title'), 'Hi');
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe('Icon', () => {
  it('is hidden from assistive tech without a label', () => {
    const { container } = render(<Icon name="search" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('becomes an image role when labelled', () => {
    render(<Icon name="search" label="Search" />);
    expect(screen.getByRole('img', { name: 'Search' })).toBeInTheDocument();
  });

  it('has path data for every registered name', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const path = container.querySelector('path');
      expect(path?.getAttribute('d'), `${name} has no path`).toBeTruthy();
      unmount();
    }
  });
});
