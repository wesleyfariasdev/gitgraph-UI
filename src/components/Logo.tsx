export function Logo({ size = "small" }: { size?: "small" | "large" }) {
  return (
    <span className={`logo logo--${size}`} data-text="NEONGIT">
      <span className="logo__accent">NEON</span>GIT
    </span>
  );
}
