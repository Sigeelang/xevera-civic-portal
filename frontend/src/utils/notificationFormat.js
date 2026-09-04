export function currentDayLabel(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Earlier';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, today)) return 'Today';
    if (same(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } catch (e) {
    return 'Earlier';
  }
}

export function groupByDate(items) {
  const order = [];
  const map = {};
  items.forEach((n) => {
    const day = currentDayLabel(n.date);
    if (!map[day]) {
      map[day] = { label: day, items: [] };
      order.push(day);
    }
    map[day].items.push(n);
  });
  return order.map((k) => map[k]);
}