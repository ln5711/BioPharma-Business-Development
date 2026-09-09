/**
 * The newwin "pulsar" mark — a Voyager-style pulsar map: rays of varying length
 * radiating from a glowing core, plus the long galactic-centre beam.
 */
export function PulsarMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      style={{ display: "block", overflow: "visible", flexShrink: 0 }}
    >
      <g stroke="#8FD3FF" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
        <line x1="50" y1="50" x2="89.6" y2="44.4" />
        <line x1="50" y1="50" x2="75.4" y2="34.1" />
        <line x1="50" y1="50" x2="75.2" y2="14.0" />
        <line x1="50" y1="50" x2="55.4" y2="24.6" />
        <line x1="50" y1="50" x2="43.4" y2="12.6" />
        <line x1="50" y1="50" x2="34.1" y2="24.6" />
        <line x1="50" y1="50" x2="12.3" y2="23.6" />
        <line x1="50" y1="50" x2="26.5" y2="45.0" />
        <line x1="50" y1="50" x2="14.6" y2="56.3" />
        <line x1="50" y1="50" x2="14.4" y2="72.3" />
        <line x1="50" y1="50" x2="33.9" y2="72.9" />
        <line x1="50" y1="50" x2="41.7" y2="89.1" />
        <line x1="50" y1="50" x2="58.3" y2="80.9" />
        <line x1="50" y1="50" x2="83.7" y2="78.3" />
      </g>
      <line
        x1="50"
        y1="50"
        x2="99"
        y2="50"
        stroke="#CDEBFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="16" fill="#8FD3FF" opacity="0.2" style={{ filter: "blur(6px)" }} />
      <circle cx="50" cy="50" r="4.6" fill="#EAF7FF" />
    </svg>
  );
}
