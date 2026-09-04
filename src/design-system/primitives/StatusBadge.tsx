export function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status.trim().toLowerCase();

  const tone =
    ["approved", "paid", "completed", "settled"].includes(normalized)
      ? "positive"
      : ["pending", "processing", "review"].includes(normalized)
        ? "warning"
        : ["rejected", "failed", "declined", "cancelled"].includes(normalized)
          ? "danger"
          : "neutral";

  return (
    <span
      className="pg-status"
      data-tone={tone}
    >
      {status}
    </span>
  );
}
