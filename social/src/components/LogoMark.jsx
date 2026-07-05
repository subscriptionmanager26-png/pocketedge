/** Substack logo mark: exactly 28×28. */
export default function LogoMark({ className = '' }) {
  return (
    <img
      src="/logo.png"
      alt="PocketEdge"
      width={28}
      height={28}
      className={`h-7 w-7 shrink-0 object-contain ${className}`}
    />
  );
}
