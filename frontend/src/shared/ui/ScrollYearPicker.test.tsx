// PR-15a iteration: a small test for the year-picker dropdown so the new
// component contributes coverage and CI's threshold stays green.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ScrollYearPicker } from './ScrollYearPicker';

describe('ScrollYearPicker', () => {
  it('renders an "all" option plus the year range, newest first, with current year as ceiling', () => {
    render(
      <ScrollYearPicker
        value={undefined}
        onChange={() => {}}
        min={2024}
        max={2026}
      />,
    );

    const options = screen.getAllByRole('option');
    // [الكل, 2026, 2025, 2024]
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('الكل');
    expect(options[1]).toHaveTextContent('2026');
    expect(options[2]).toHaveTextContent('2025');
    expect(options[3]).toHaveTextContent('2024');
  });

  it('reflects the controlled value', () => {
    render(
      <ScrollYearPicker
        value={2025}
        onChange={() => {}}
        min={2024}
        max={2026}
      />,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('2025');
  });

  it('emits a number on change and undefined on clear', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ScrollYearPicker
        value={undefined}
        onChange={onChange}
        min={2024}
        max={2026}
      />,
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: '2025' } });
    expect(onChange).toHaveBeenLastCalledWith(2025);

    rerender(
      <ScrollYearPicker
        value={2025}
        onChange={onChange}
        min={2024}
        max={2026}
      />,
    );
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('accepts a string value (resolved-register sends year as string)', () => {
    render(
      <ScrollYearPicker
        value={'2025'}
        onChange={() => {}}
        min={2024}
        max={2026}
      />,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('2025');
  });
});
