import React from 'react';
import type { AdminSetting, SettingValue } from '@/services/adminSettingsApi';

interface Props {
  setting: AdminSetting;
  value: SettingValue;
  error?: string;
  onChange: (value: SettingValue) => void;
}

const desktopInputCls = (error?: string) =>
  `w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 ${error ? 'border-red-400' : 'border-gray-300'}`;

/** One setting: label, description, the right input for its type, validation hint and error. */
const DesktopSettingField: React.FC<Props> = ({ setting, value, error, onChange }) => {
  const id = `setting-${setting.key}`;
  const isNumber = setting.type === 'number' || setting.type === 'integer';
  const hint = isNumber && (setting.min !== undefined || setting.max !== undefined)
    ? `Allowed: ${setting.min ?? '…'} to ${setting.max ?? '…'}${setting.unit ? ` ${setting.unit}` : ''}`
    : setting.type === 'list' ? 'Comma-separated, 6-digit pincodes'
    : setting.format === 'url' ? 'Full link starting with https://. Leave empty to hide it on the website.' : '';

  return (
    <div className="grid gap-2 border-b border-gray-100 py-4 last:border-0 md:grid-cols-[1fr_320px] md:gap-6">
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-gray-900">{setting.label}</label>
        <p className="mt-0.5 text-xs text-gray-500">{setting.description}</p>
        {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
      </div>
      <div>
        {setting.type === 'boolean' ? (
          <button
            id={id}
            type="button"
            role="switch"
            aria-checked={value === true}
            onClick={() => onChange(value !== true)}
            className={`relative h-6 w-11 rounded-full transition-colors ${value === true ? 'bg-[#4338ca]' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value === true ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        ) : isNumber ? (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="number"
              inputMode="decimal"
              className={desktopInputCls(error)}
              value={typeof value === 'number' ? value : ''}
              min={setting.min}
              max={setting.max}
              step={setting.type === 'integer' ? 1 : 'any'}
              onChange={(e) => onChange(e.target.value === '' ? ('' as unknown as number) : Number(e.target.value))}
            />
            {setting.unit && <span className="text-xs text-gray-500">{setting.unit}</span>}
          </div>
        ) : setting.type === 'list' ? (
          <textarea
            id={id}
            rows={3}
            className={desktopInputCls(error)}
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => onChange(e.target.value.split(/[,\s]+/).filter(Boolean))}
          />
        ) : (
          <input
            id={id}
            type={setting.format === 'url' ? 'url' : 'text'}
            placeholder={setting.format === 'url' ? 'https://' : undefined}
            className={desktopInputCls(error)}
            value={typeof value === 'string' ? value : ''}
            maxLength={setting.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
};


const inputCls = (error?: string) =>
  `w-full rounded-xl border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${
    error ? 'border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
  }`;

/** One setting: label, description, the right input for its type, validation hint and error. */
const MobileSettingField: React.FC<Props> = ({ setting, value, error, onChange }) => {
  const id = `setting-${setting.key}`;
  const isNumber = setting.type === 'number' || setting.type === 'integer';
  const isBool = setting.type === 'boolean';
  const hint = isNumber && (setting.min !== undefined || setting.max !== undefined)
    ? `Allowed: ${setting.min ?? '…'} to ${setting.max ?? '…'}${setting.unit ? ` ${setting.unit}` : ''}`
    : setting.type === 'list' ? 'Comma-separated, 6-digit pincodes'
    : setting.format === 'url' ? 'Full link starting with https://. Leave empty to hide it on the website.' : '';

  const label = (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-semibold text-slate-900">{setting.label}</label>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{setting.description}</p>
      {hint && <p className="mt-1 text-[11px] font-medium text-slate-400">{hint}</p>}
    </div>
  );

  // Toggles sit on the same row as their label, on every screen size.
  if (isBool) {
    return (
      <div className="flex items-center justify-between gap-4 py-4">
        {label}
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={value === true}
          onClick={() => onChange(value !== true)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 ${value === true ? 'bg-[#4338ca]' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${value === true ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:items-start md:gap-8">
      {label}
      <div className="min-w-0">
        {isNumber ? (
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="number"
              inputMode="decimal"
              className={inputCls(error)}
              value={typeof value === 'number' ? value : ''}
              min={setting.min}
              max={setting.max}
              step={setting.type === 'integer' ? 1 : 'any'}
              onChange={(e) => onChange(e.target.value === '' ? ('' as unknown as number) : Number(e.target.value))}
            />
            {setting.unit && <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">{setting.unit}</span>}
          </div>
        ) : setting.type === 'list' ? (
          <textarea
            id={id}
            rows={3}
            className={inputCls(error)}
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => onChange(e.target.value.split(/[,\s]+/).filter(Boolean))}
          />
        ) : (
          <input
            id={id}
            type={setting.format === 'url' ? 'url' : 'text'}
            placeholder={setting.format === 'url' ? 'https://' : undefined}
            className={inputCls(error)}
            value={typeof value === 'string' ? value : ''}
            maxLength={setting.maxLength}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
};

/** Web keeps the original look; phones get the roomier touch-friendly one. */
export const SettingField: React.FC<Props & { mobile?: boolean }> = ({ mobile, ...props }) =>
  mobile ? <MobileSettingField {...props} /> : <DesktopSettingField {...props} />;

export default SettingField;