// Local persistence for expense -> label mapping (frontend-only)
const STORAGE_KEY = 'expenseLabelsV1';

function safeRead() {
  if (typeof window === "undefined") return {};  // ✅ SSR safe

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeWrite(obj) {
  if (typeof window === "undefined") return;  // ✅ SSR safe

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

export function setExpenseLabel(expenseId, labelKey) {
  if (typeof window === "undefined") return;  // ✅ SSR safe
  if (!expenseId || !labelKey) return;

  const data = safeRead();
  data[String(expenseId)] = labelKey;
  safeWrite(data);
}

export function getExpenseLabel(expenseId) {
  if (typeof window === "undefined") return null; // ✅ SSR safe
  if (!expenseId) return null;

  const data = safeRead();
  return data[String(expenseId)] || null;
}

export function getAllExpenseLabels() {
  if (typeof window === "undefined") return {}; // ✅ SSR safe
  return safeRead();
}
