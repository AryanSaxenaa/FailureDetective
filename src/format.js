export function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function truncateText(value, limit = 2000) {
  if (!value) {
    return "";
  }
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

export function humanTimestamp() {
  return new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
