// Centralized label catalog for expenses
// Frontend-only; keys should match Add Expense modal selections

export const LABELS = [
  { key: "food", label: "Food", icon: "🍽️" },
  { key: "transport", label: "Transport", icon: "🚕" },
  { key: "entertainment", label: "Entertainment", icon: "🎬" },
  { key: "rent", label: "Rent", icon: "🏠" },
  { key: "electricity", label: "Electricity", icon: "⚡" },
  { key: "groceries", label: "Groceries", icon: "🛒" },
  { key: "gift", label: "Gift", icon: "🎁" },
  // Misc uses Splitmate logo image from /public (prefer PNG; fallback SVG if present)
  { key: "misc", label: "Others", img: "/logo.png", imgFallback: "/logo.svg" },
];

export function getLabelByKey(key) {
  const found = LABELS.find((l) => l.key === key);
  return found || LABELS.find((l) => l.key === "misc");
}
