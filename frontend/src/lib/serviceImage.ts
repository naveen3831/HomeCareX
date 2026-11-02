/**
 * Picks a stock photo for a service from its name. The backend does not send service images to the
 * public site yet, so both the Services page and the Home page use this one mapping.
 */
export function serviceImageFor(rawName: string): string {
  const name = rawName.toLowerCase();

  if (name.includes("deep") && name.includes("clean")) return "/images/deep-cleaning.jpg";
  if (name.includes("clean") && name.includes("bathroom")) return "/images/bathroom-cleaning.webp";
  if (name.includes("clean")) return "/images/home-cleaning.jpg";
  if (
    name.includes("ac service") ||
    name.includes("ac repair") ||
    name.includes("gas refill") ||
    name.includes("appliance") ||
    name.includes("geyser") ||
    name.includes("refrigerator") ||
    name.includes("washing machine") ||
    name.includes("microwave")
  ) {
    return "/images/appliance-repair.jpg";
  }
  if (name.includes("electrician") || name.includes("electrical")) return "/images/electrical.jpg";
  if (name.includes("plumbing")) return "/images/plumbing.jpg";
  if (name.includes("painting")) return "/images/painting.jpg";
  if (name.includes("maintenance")) return "/images/home-maintenance.jpg";
  if (name.includes("pest")) return "/images/pest-control-clean.webp";
  if (name.includes("massage")) return "/images/full-body-massage.webp";
  if (name.includes("makeup")) return "/images/bridal-makeup.webp";
  if (name.includes("bathroom")) return "/images/bathroom-cleaning.webp";
  return "/images/home-cleaning.jpg";
}
