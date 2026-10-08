import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberInput } from '../number-input';

describe('NumberInput', () => {
  it('renders the numeric value as text', () => {
    render(<NumberInput value={5} onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(5);
  });

  it('renders an empty field when value is undefined or null', () => {
    const { rerender } = render(<NumberInput value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(null);

    rerender(<NumberInput value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
  });

  it('lets the user clear the field without snapping back to a default while typing', () => {
    const onChange = vi.fn();
    render(<NumberInput value={1} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    // Clearing must NOT push a fallback value upstream while still editing.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not concatenate digits: replacing 1 with 2 produces 2, not 12', () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumberInput value={1} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    // Simulate: user clears the field, then types "2" — the browser sends
    // the input's own new value on each change event, so after clearing the
    // next change event's target.value is just "2", not "12".
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '2' } });

    expect(input.value).toBe('2');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('never emits a leading-zero value: typing "1" reports 1, not "01"', () => {
    const onChange = vi.fn();
    render(<NumberInput value={undefined} onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '1' } });

    expect(input.value).toBe('1');
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('applies the fallback value only on blur, when left empty', () => {
    const onChange = vi.fn();
    render(<NumberInput value={1} onChange={onChange} fallback={0} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(0);
    expect(input.value).toBe('0');
  });

  it('applies the fallback on blur when the entered text is not a valid number', () => {
    const onChange = vi.fn();
    render(<NumberInput value={1} onChange={onChange} fallback={1} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '-' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('parses decimals only when decimal is true', () => {
    const onChangeInt = vi.fn();
    const { unmount } = render(<NumberInput value={undefined} onChange={onChangeInt} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2.5' } });
    // parseInt('2.5', 10) === 2
    expect(onChangeInt).toHaveBeenCalledWith(2);
    unmount();

    const onChangeDecimal = vi.fn();
    render(<NumberInput value={undefined} onChange={onChangeDecimal} decimal />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2.5' } });
    expect(onChangeDecimal).toHaveBeenCalledWith(2.5);
  });

  it('resyncs the displayed text when the value prop changes from outside (e.g. switching rows)', () => {
    const { rerender } = render(<NumberInput value={1} onChange={vi.fn()} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('1');

    rerender(<NumberInput value={7} onChange={vi.fn()} />);

    expect(input.value).toBe('7');
  });

  it('calls onBlur with the committed numeric value', () => {
    const onBlur = vi.fn();
    render(<NumberInput value={3} onChange={vi.fn()} onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole('spinbutton'));

    expect(onBlur).toHaveBeenCalledWith(3);
  });
});
