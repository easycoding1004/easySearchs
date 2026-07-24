// Re-mounts on every navigation (unlike layout.tsx, which persists) so the
// page-transition CSS animation replays on each page-view change.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition flex flex-1 flex-col">{children}</div>;
}
