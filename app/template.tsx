/**
 * Templates get a fresh key when their segment changes, so this element
 * remounts on every tab switch — which restarts the `blur-in` keyframe in
 * globals.css. That is the entire page-transition mechanism: no JavaScript,
 * no client component, no View Transitions API.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-body">{children}</div>;
}
