import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimePicker } from '../time-picker';

const openPicker = async (user: ReturnType<typeof userEvent.setup>, value = '10:52') => {
  const onChange = vi.fn();
  render(<TimePicker value={value} onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: value }));
  expect(await screen.findByText('Seleccionar hora')).toBeInTheDocument();
  return onChange;
};

const getDisplay = () => screen.getByTestId('time-picker-display');
const getDial = () => screen.getByTestId('time-picker-dial');

describe('TimePicker', () => {
  it('renders the trigger with the formatted value and a clock icon', () => {
    render(<TimePicker value="09:05" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '09:05' })).toBeInTheDocument();
  });

  it('defaults to 00:00 when given an empty value', () => {
    render(<TimePicker value="" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '00:00' })).toBeInTheDocument();
  });

  it('opens on the hour step showing the current value in the digital display', async () => {
    const user = userEvent.setup();
    await openPicker(user, '10:52');

    const display = getDisplay();
    expect(within(display).getByText('10')).toBeInTheDocument();
    expect(within(display).getByText('52')).toBeInTheDocument();

    // Hour dial is shown first (outer ring 1-12, inner ring 00/13-23).
    expect(within(getDial()).getByText('3')).toBeInTheDocument();
  });

  it('picking an hour advances to the minute step and updates the digital display', async () => {
    const user = userEvent.setup();
    await openPicker(user, '10:52');

    await user.click(within(getDial()).getByText('3'));

    expect(within(getDisplay()).getByText('03')).toBeInTheDocument();
    // Minute dial is now shown (multiples of 5, two-digit labels).
    expect(within(getDial()).getByText('40')).toBeInTheDocument();
  });

  it('confirms the selected hour and minute on Aceptar', async () => {
    const user = userEvent.setup();
    const onChange = await openPicker(user, '10:52');

    await user.click(within(getDial()).getByText('3'));
    await user.click(within(getDial()).getByText('40'));
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(onChange).toHaveBeenCalledWith('03:40');
    await waitFor(() => expect(screen.queryByTestId('time-picker-display')).not.toBeInTheDocument());
  });

  it('discards changes on Cancelar', async () => {
    const user = userEvent.setup();
    const onChange = await openPicker(user, '10:52');

    await user.click(within(getDial()).getByText('3'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('time-picker-display')).not.toBeInTheDocument());
  });

  it('resets the draft from the current value each time it is reopened', async () => {
    const user = userEvent.setup();
    render(<TimePicker value="10:52" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '10:52' }));
    await user.click(within(getDial()).getByText('3'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await user.click(screen.getByRole('button', { name: '10:52' }));
    expect(within(getDisplay()).getByText('10')).toBeInTheDocument();
  });

  it('clicking the minute segment of the digital display jumps straight to the minute step', async () => {
    const user = userEvent.setup();
    await openPicker(user, '10:52');

    await user.click(within(getDisplay()).getByText('52'));

    expect(within(getDial()).getByText('40')).toBeInTheDocument();
  });

  it('allows entering an exact time via the keyboard toggle', async () => {
    const user = userEvent.setup();
    const onChange = await openPicker(user, '10:52');

    await user.click(screen.getByRole('button', { name: 'Ingresar hora con teclado' }));

    const hourField = screen.getByLabelText('Hora');
    const minuteField = screen.getByLabelText('Minutos');
    await user.clear(hourField);
    await user.type(hourField, '7');
    await user.clear(minuteField);
    await user.type(minuteField, '37');

    await user.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(onChange).toHaveBeenCalledWith('07:37');
  });
});
