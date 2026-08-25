/** Selected topic/filter chips — brand orange, shared across surfaces. */
export default function FilterChip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
        selected
          ? 'border-pe-accent bg-pe-accent text-white'
          : 'border-pe-border bg-white text-pe-text-secondary hover:border-pe-accent/40 hover:text-pe-text'
      }`}
    >
      {children}
    </button>
  );
}
