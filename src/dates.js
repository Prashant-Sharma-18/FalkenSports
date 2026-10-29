// Days are passed around as "YYYY-MM-DD" keys in the viewer's local time.

const pad = (n) => String(n).padStart(2, "0");

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDayKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !isNaN(fromKey(value));
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(key, days) {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function dayLabel(key) {
  const diff = Math.round((fromKey(key) - fromKey(todayKey())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return fromKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
