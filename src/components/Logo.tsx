export function Logo({ size = "small" }: { size?: "small" | "large" }) {
  return (
    <span className={`logo logo--${size}`} data-text="GITGRAPH">
      GIT<span className="logo__accent">GRAPH</span>
    </span>
  );
}
