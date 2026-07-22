const utcTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatUtcTimestamp(
  value: string | null,
  emptyLabel = "Not recorded",
) {
  if (!value) return emptyLabel;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;

  return `${utcTimestampFormatter.format(date)} UTC`;
}
