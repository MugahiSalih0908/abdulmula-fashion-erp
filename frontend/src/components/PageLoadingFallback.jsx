export default function PageLoadingFallback() {
  return (
    <div className="page-loading" role="status" aria-live="polite" aria-label="Loading page">
      <span className="page-loading-status">Loading workspace</span>
      <div className="page-loading-header">
        <div className="page-loading-block page-loading-title" />
        <div className="page-loading-block page-loading-action" />
      </div>
      <div className="page-loading-metrics">
        {[0, 1, 2, 3].map(item => <div key={item} className="page-loading-card"><span /><strong /><small /></div>)}
      </div>
      <div className="page-loading-body">
        <div className="page-loading-block page-loading-search" />
        {[0, 1, 2, 3, 4].map(item => <div key={item} className="page-loading-row"><span /><div><strong /><small /></div><i /></div>)}
      </div>
      <span className="sr-only">The requested page is loading.</span>
    </div>
  );
}
