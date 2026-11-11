/**
 * 3D icons (Microsoft Fluent Emoji 3D, MIT licence) bundled in /public/icons/3d.
 * Category / service data comes from the API with an emoji or nothing, so we resolve
 * the right picture from the emoji first and then from keywords in the name or slug.
 */
export type Icon3DName =
  | "ant" | "broom" | "bug" | "droplet" | "gift" | "gift-green" | "house" | "house-garden" | "light-bulb" | "massage"
  | "paintbrush" | "palette" | "party" | "plug" | "scissors" | "shower" | "snowflake" | "soap"
  | "sparkles-lavender" | "toolbox" | "tools" | "wrench";

const EMOJI_TO_ICON: Record<string, Icon3DName> = {
  "🧹": "broom", "🧽": "soap", "🧼": "soap", "🔧": "wrench", "🛠": "tools", "🪚": "tools", "🔨": "tools",
  "🪑": "tools", "🛋️": "soap", "🛋": "soap", "💆": "massage", "💇": "scissors",
  "✂": "scissors", "✂️": "scissors", "💡": "light-bulb", "🔌": "plug", "⚡": "light-bulb", "🎨": "palette", "🖌": "paintbrush",
  "🐜": "ant", "🐛": "bug", "🪲": "bug", "🦟": "bug", "❄": "snowflake", "❄️": "snowflake", "💧": "droplet", "🚿": "shower",
  "🚰": "droplet", "🧰": "toolbox", "🏠": "house", "🏡": "house-garden", "🎁": "gift", "🎉": "party",
};

// Order matters: the first match wins.
const KEYWORDS: [RegExp, Icon3DName][] = [
  [/\b(ac|air.?condition|refrigerat|fridge|cooling)\b/i, "snowflake"],
  [/(pest|termite|cockroach|rodent|bug|ant|mosquito)/i, "bug"],
  [/(spa|massage|facial|salon|beauty|makeup|bridal)/i, "massage"],
  [/(hair|haircut|barber|scissor)/i, "scissors"],
  [/(plumb|tap|leak|water|pipe|ro\b|purifier|drain|tank)/i, "droplet"],
  [/(electric|wiring|switch|socket|fan|light|bulb|lamp)/i, "light-bulb"],
  [/(carpenter|carpentry|furniture|assembly|drawer|wardrobe|door|lock|wood|saw|fitting|shelf)/i, "tools"],
  [/(sofa|carpet|shampoo|laundry|wash|sanitiz|disinfect|clean|maid|sweep|mop|deep.?clean)/i, "broom"],
  [/(bath|shower|toilet)/i, "shower"],
  [/(paint|waterproof|wall)/i, "palette"],
  [/(repair|appliance|service|fix|maintenance|geyser|washing.?machine|microwave)/i, "wrench"],
];

const normalise = (s: string) => s.replace(/[\uFE0F\u200D]/g, "").trim();

/** Pass any hints (emoji, name, slug, category) — the first one that resolves wins. */
export function resolveIcon3D(...hints: (string | null | undefined)[]): Icon3DName {
  for (const hint of hints) {
    if (!hint) continue;
    const key = normalise(hint);
    if (EMOJI_TO_ICON[key]) return EMOJI_TO_ICON[key];
  }
  for (const hint of hints) {
    if (!hint) continue;
    const text = hint.toLowerCase();
    if (text === "gift-green") return "gift-green";
    if (text === "sparkles-lavender") return "sparkles-lavender";
    for (const [pattern, name] of KEYWORDS) if (pattern.test(text)) return name;
  }
  return "tools";
}

/**
 * Maps category or service hints to a relevant service emoji.
 * Examples:
 * 🧹 Home Cleaning, 🛋️ Sofa Cleaning, 🧼 Deep Cleaning, ❄️ AC Service,
 * 🔧 Plumbing, 💡 Electrical Services, 🎨 Painting, 🚰 Water-related Services,
 * 🪚 Carpentry, 🐜 Pest Control, 💆 Salon & Spa.
 */
export function getServiceEmoji(...hints: (string | null | undefined)[]): string {
  for (const hint of hints) {
    if (!hint) continue;
    const text = hint.toLowerCase().trim();
    if (text.includes("sofa") || text.includes("carpet")) return "🛋️";
    if (text.includes("deep") || text.includes("sanitiz") || text.includes("disinfect") || text.includes("toilet") || text.includes("bath")) return "🧼";
    if (text.includes("ac") || text.includes("cooling") || text.includes("refrigerat") || text.includes("fridge")) return "❄️";
    if (text.includes("ro") || text.includes("purifier") || text.includes("water tank") || text.includes("tank")) return "🚰";
    if (text.includes("plumb") || text.includes("tap") || text.includes("leak") || text.includes("pipe") || text.includes("geyser")) return "🔧";
    if (text.includes("electric") || text.includes("wiring") || text.includes("light") || text.includes("bulb") || text.includes("fan") || text.includes("switch")) return "💡";
    if (text.includes("paint") || text.includes("waterproof") || text.includes("wall")) return "🎨";
    if (text.includes("carpentr") || text.includes("furniture") || text.includes("assembly") || text.includes("door") || text.includes("lock") || text.includes("wardrobe") || text.includes("shelf") || text.includes("saw")) return "🪚";
    if (text.includes("pest") || text.includes("termite") || text.includes("ant") || text.includes("mosquito") || text.includes("bug") || text.includes("cockroach")) return "🐜";
    if (text.includes("hair") || text.includes("haircut") || text.includes("barber")) return "✂️";
    if (text.includes("spa") || text.includes("massage") || text.includes("salon") || text.includes("makeup") || text.includes("facial") || text.includes("beauty")) return "💆";
    if (text.includes("clean") || text.includes("sweep") || text.includes("mop") || text.includes("maid")) return "🧹";
    if (text.includes("repair") || text.includes("appliance") || text.includes("fix") || text.includes("washing machine") || text.includes("microwave")) return "🔧";
  }
  for (const hint of hints) {
    if (hint && /\p{Extended_Pictographic}/u.test(hint)) return hint;
  }
  return "🔧";
}

/** Soft background tints that rotate across cards (brand indigo / brand orange first). */
export const ICON_TINTS = [
  "bg-brand-soft",
  "bg-accent-soft",
  "bg-[#E4F4EC]",
  "bg-[#FFF3C9]",
  "bg-[#FDE7F0]",
  "bg-[#E3F0FC]",
] as const;

export const tintAt = (index: number) => ICON_TINTS[index % ICON_TINTS.length];
