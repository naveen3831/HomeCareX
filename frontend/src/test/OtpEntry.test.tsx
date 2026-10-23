import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OtpEntry from '@/components/partner/OtpEntry';

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <OtpEntry
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}
const box = (n: number) => screen.getByLabelText(new RegExp(`digit ${n} of 4`));

describe('OtpEntry', () => {
  it('renders 4 labelled boxes in a group', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: /customer code/i })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });

  it('moves to the next box as digits are typed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(box(1));
    await user.keyboard('4821');
    expect(onChange).toHaveBeenLastCalledWith('4821');
    expect(box(4)).toHaveValue('1');
    expect(box(4)).toHaveFocus();
  });

  it('ignores letters and symbols', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(box(1));
    await user.keyboard('a-b 7');
    expect(onChange).toHaveBeenLastCalledWith('7');
  });

  it('fills all boxes on paste and drops non-digits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(box(1));
    await user.paste('48-21 99');
    expect(onChange).toHaveBeenLastCalledWith('4821');
  });

  it('Backspace on an empty box goes back and clears the previous digit', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(box(1));
    await user.keyboard('48');
    expect(box(3)).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(box(2)).toHaveFocus();
    expect(box(2)).toHaveValue('');
    expect(box(1)).toHaveValue('4');
  });

  it('arrow keys move between boxes (keyboard only)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(box(2));
    await user.keyboard('{ArrowLeft}');
    expect(box(1)).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(box(3)).toHaveFocus();
  });

  it('marks boxes invalid and disables them on request', () => {
    const { rerender } = render(<OtpEntry value="" onChange={() => {}} invalid />);
    expect(box(1)).toHaveAttribute('aria-invalid', 'true');
    rerender(<OtpEntry value="" onChange={() => {}} disabled />);
    expect(box(1)).toBeDisabled();
  });

  it('offers the phone one-time-code autofill on the first box only', () => {
    render(<Harness />);
    expect(box(1)).toHaveAttribute('autocomplete', 'one-time-code');
    expect(box(2)).toHaveAttribute('autocomplete', 'off');
  });
});
