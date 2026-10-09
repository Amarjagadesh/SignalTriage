// Kept in one place so every component (chart, table, cards) agrees on
// what color a given triage label gets -- change it here, it updates everywhere.
export const TRIAGE_COLOR_VAR = {
  "Review priority": "--color-review",
  "Monitor": "--color-monitor",
  "Unstable ratio": "--color-monitor",
  // Raised ratio that failed the chi-square test -- grouped with the other
  // "worth watching, not yet actionable" states rather than given its own hue.
  "Weak evidence": "--color-monitor",
  "Limited data": "--color-monitor",
  "Background level": "--color-background-level",
  "Comparator unavailable": "--color-muted",
  "Insufficient data": "--color-muted",
};

export function triageColor(label) {
  const varName = TRIAGE_COLOR_VAR[label] || "--color-muted";
  return `var(${varName})`;
}
