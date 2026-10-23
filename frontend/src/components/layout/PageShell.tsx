interface PageShellProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/**
 * PageShell — shared visual wrapper every customer page uses so new pages
 * start consistent (title, optional description, panel container) without
 * re-typing the same markup in every folder's index.tsx.
 */
export default function PageShell({
  title,
  description,
  children,
}: PageShellProps) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6">
      {/* The customer top bar already shows the page name; keep a real heading for screen readers. */}
      <h1 className="sr-only">{title}</h1>
      {description && <p className="text-muted text-sm mt-1">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
