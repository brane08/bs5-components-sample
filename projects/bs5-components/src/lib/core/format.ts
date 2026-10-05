/** Replaces `{name}` placeholders, e.g. `format('Remove {label}', { label: 'Java' })`. Unknown names are kept. */
export function format(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
