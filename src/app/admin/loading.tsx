// Gives every admin page its own loading boundary, so navigating between admin pages
// shows this placeholder instantly while the page's data loads.
export default function AdminLoading() {
  return <div className="card h-96 animate-pulse" aria-label="Loading" />;
}
