export function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export function formatMomentDate(value: string) {
  if (!value) return 'Date not set';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

export function isUpcoming(value: string, today = new Date()) {
  const date = new Date(`${value}T23:59:59`);
  return date.getTime() >= today.getTime();
}
