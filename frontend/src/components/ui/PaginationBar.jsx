export default function PaginationBar({ page, total, totalPages, pageSize = 25, onPageChange }) {
  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Pagination">
      <p className="text-xs text-[var(--color-text-muted)]">
        Showing <strong className="text-[var(--color-text)]">{start}–{end}</strong> of <strong className="text-[var(--color-text)]">{total.toLocaleString('en-IN')}</strong> records
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40">
          Previous
        </button>
        <span className="min-w-20 text-center text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
          {page} / {totalPages}
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-40">
          Next
        </button>
      </div>
    </nav>
  );
}
