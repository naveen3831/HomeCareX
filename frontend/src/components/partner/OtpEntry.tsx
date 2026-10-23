import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ClipboardEvent, ChangeEvent, KeyboardEvent } from 'react';
import './jobVerification.css';

export interface OtpEntryHandle {
  /** Puts the cursor in the first empty box (or the last one when full). */
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Number of digits. The start OTP is 4. */
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  /** id of the element that describes this field (hint / error), for screen readers. */
  describedBy?: string;
}

/**
 * Digit-by-digit code entry. Works with keyboard only (Backspace, arrows), paste, and the phone's
 * one-time-code autofill. Always numeric; anything else typed or pasted is dropped.
 */
const OtpEntry = forwardRef<OtpEntryHandle, Props>(function OtpEntry(
  { value, onChange, length = 4, disabled = false, invalid = false, label = 'Customer code', describedBy },
  ref,
) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const focusAt = (i: number): void => {
    inputs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  };

  useImperativeHandle(ref, () => ({ focus: () => focusAt(value.length) }));

  /** Replaces from `index` onward with the typed/pasted digits. */
  const write = (index: number, raw: string): void => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    const at = Math.min(index, value.length);
    onChange((value.slice(0, at) + clean + value.slice(at + clean.length)).slice(0, length));
    focusAt(at + clean.length);
  };

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(value.slice(0, index) + value.slice(index + 1));
      return;
    }
    write(index, raw);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      onChange(value.slice(0, index - 1) + value.slice(index));
      focusAt(index - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    write(index, e.clipboardData.getData('text'));
  };

  return (
    <div role="group" aria-label={label} aria-describedby={describedBy} className="otpe-row">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          className={`otpe-box${digit ? ' otpe-box-filled' : ''}${invalid ? ' otpe-box-invalid' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={digit}
          disabled={disabled}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
});

export default OtpEntry;
