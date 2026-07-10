function formatIndexGroup(group) {
  if (!group) return null;
  return group
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export { formatIndexGroup };
