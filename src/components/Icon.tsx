// Line icons drawn on a 24 px grid with a 1.6 px stroke.
const PATHS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17.2v.1"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  cube: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  labels: '<circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="15" r="2.5"/><path d="M10.2 10.4l3.6 3.2"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  ext: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M17 14v5H5V7h5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  dash: '<path d="M7 12h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "i" }: { name: IconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />;
}
