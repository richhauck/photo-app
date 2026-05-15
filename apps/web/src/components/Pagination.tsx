import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  pathname: string;
  q: string;
};

function pageHref(pathname: string, q: string, p: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (p > 1) params.set("page", String(p));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

export default function Pagination({ page, totalPages, pathname, q }: Props) {
  if (totalPages <= 1) return null;

  const pages = pageNumbers(page, totalPages);
  const btnBase = "rounded px-3 py-1.5 text-sm font-medium transition-colors";
  const btnActive = "bg-black text-white";
  const btnInactive = "text-gray-700 hover:bg-gray-100";
  const btnDisabled = "pointer-events-none text-gray-300";

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1">
      <Link
        href={page > 1 ? pageHref(pathname, q, page - 1) : "#"}
        aria-disabled={page <= 1}
        className={`${btnBase} ${page <= 1 ? btnDisabled : btnInactive}`}
      >
        ← Prev
      </Link>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={pageHref(pathname, q, p)}
            aria-current={p === page ? "page" : undefined}
            className={`${btnBase} ${p === page ? btnActive : btnInactive}`}
          >
            {p}
          </Link>
        ),
      )}

      <Link
        href={page < totalPages ? pageHref(pathname, q, page + 1) : "#"}
        aria-disabled={page >= totalPages}
        className={`${btnBase} ${page >= totalPages ? btnDisabled : btnInactive}`}
      >
        Next →
      </Link>
    </nav>
  );
}
