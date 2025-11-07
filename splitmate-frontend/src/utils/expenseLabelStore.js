// Local persistence for expense -> label mapping (frontend-only)
const STORAGE_KEY = 'expenseLabelsV1';

function safeRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeWrite(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

export function setExpenseLabel(expenseId, labelKey) {
  if (!expenseId || !labelKey) return;
  const data = safeRead();
  data[String(expenseId)] = labelKey;
  safeWrite(data);
}

export function getExpenseLabel(expenseId) {
  if (!expenseId) return null;
  const data = safeRead();
  return data[String(expenseId)] || null;
}

export function getAllExpenseLabels() {
  return safeRead();
}
