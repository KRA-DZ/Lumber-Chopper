// Shared by the carried stack and both ends of the transfer animation.
// Every inventory slot is visible; additional columns keep 82 logs on screen.
export function stackOffset(index, count) {
  const rows = 28,
    columns = Math.ceil(Math.max(1, count) / rows);
  return {
    x: (Math.floor(index / rows) - (columns - 1) / 2) * 44,
    y: -4 - (index % rows) * 9,
  };
}
