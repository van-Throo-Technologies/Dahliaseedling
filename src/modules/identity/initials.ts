/** The letters shown in an avatar when a person has no photo: the first letter of the first and the last name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = (parts[0] ?? "").charAt(0);
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "").charAt(0) : "";
  return (first + last).toUpperCase();
}
