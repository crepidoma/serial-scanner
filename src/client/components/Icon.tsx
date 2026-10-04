const paths = {
  camera: [
    "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z",
    "M12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z",
  ],
  image: [
    "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M3 16l5-5 4 4 3-3 6 6",
    "M15.5 8a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z",
  ],
  copy: ["M9 9h11v11H9z", "M5 15H4V4h11v1"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  close: ["M6 6l12 12M18 6L6 18"],
  plus: ["M12 5v14M5 12h14"],
  trash: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13"],
  edit: ["M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"],
  external: ["M14 4h6v6M20 4l-9 9", "M18 14v6H4V6h6"],
  lock: ["M6 11h12v9H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  bookmark: ["M6 3h12v18l-6-4-6 4z"],
  warn: ["M12 4 2.5 20h19z", "M12 10v4.5", "M12 17.5h.01"],
  chevronLeft: ["M15 6l-6 6 6 6"],
} as const;

/** 画面で使うアイコンの名前。 */
export type IconName = keyof typeof paths;

/** 線で描いたアイコン。意味は隣の文字か `aria-label` で伝えるため、読み上げからは隠す。 */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
