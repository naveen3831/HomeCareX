import { LANGUAGES, type Language } from "@/features/customer";
import { Field, inputClass } from "./formKit";

const LABELS: Record<Language, string> = { en: "English", hi: "हिन्दी (Hindi)", te: "తెలుగు (Telugu)" };

/** Controlled language picker. Saving happens in the surrounding PreferencesCard. */
export default function LanguageSelect({ value, onChange, disabled }: { value: Language; onChange: (l: Language) => void; disabled?: boolean }) {
  return (
    <Field id="pref-language" label="Language">
      {(a) => (
        <select {...a} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Language)} className={inputClass(false)}>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {LABELS[l]}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
