// 1.5px outline icons on a 24px grid, square caps. Always shown beside a word, except close/back.
const PATHS: Record<string, string> = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 3.5l9.5 16.5h-19L12 3.5zM12 10v4.5M12 17v.5",
  clock: "M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5V12l3 2",
  home: "M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5",
  inbox: "M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5M3.5 13.5L6 5h12l2.5 8.5V19h-17v-5.5z",
  folder: "M3.5 6.5h6l2 2h9v10h-17v-12z",
  users: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 010 6.5M18 14.8c2 .7 3.2 2.5 3.5 5.2",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6zM19.5 12l1.5-1-1.5-3.5-2 .3-1.3-1.3.3-2L13 3h-2l-1 1.5-2 .3L6.8 4.5 4 7.5l1 1.7-.3 1.8L3 12l1.7 1 .3 1.8-1 1.7 2.8 3 1.7-1 1.8.3L11 21h2l1-1.7 1.8-.3 1.7 1 2.8-3-1-1.7.3-1.8z",
  camera: "M3.5 8h4l1.5-2.5h6L16.5 8h4v11h-17V8zM12 10.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
  mic: "M12 3.5a2.5 2.5 0 00-2.5 2.5v6a2.5 2.5 0 005 0V6A2.5 2.5 0 0012 3.5zM6 11.5a6 6 0 0012 0M12 17.5V21",
  pin: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  text: "M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3v-10z",
  video: "M3.5 6.5h12v11h-12v-11zM15.5 10.5l5-3v9l-5-3",
  send: "M3.5 11.5l17-7.5-7.5 17-2-7.5-7.5-2z",
  plus: "M12 5v14M5 12h14",
  copy: "M8.5 8.5h11v11h-11v-11zM15.5 8.5v-4h-11v11h4",
  external: "M13.5 4.5h6v6M19.5 4.5l-9 9M17 13.5v6h-12v-12h6",
  back: "M14.5 5.5L8 12l6.5 6.5",
  x: "M6 6l12 12M18 6L6 18",
  pause: "M8.5 5.5v13M15.5 5.5v13",
  truck: "M2.5 6.5h11v10h-11v-10zM13.5 10h4l3 3v3.5h-7M6.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  phone: "M5 4h4l1.5 4-2.5 1.5a11 11 0 006.5 6.5L16 13.5l4 1.5v4c0 .8-.7 1.5-1.5 1.5C10.5 20 4 13.5 4 5.5 4 4.7 4.7 4 5 4z",
  bolt: "M13 3l-8 10.5h6L10 21l8-10.5h-6L13 3z",
  file: "M6 3.5h8l4 4v13H6v-17zM14 3.5v4h4",
  refresh: "M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4h-4",
  calendar: "M4 6h16v14H4V6zM4 10h16M8 3.5V7M16 3.5V7",
  logout: "M9.5 4.5h-5v15h5M14 8l4 4-4 4M18 12H9",
};

export function Icon({ name, size = "md", title }: { name: keyof typeof PATHS | string; size?: "sm" | "md"; title?: string }) {
  return (
    <svg
      className={`tn-ico${size === "sm" ? " tn-ico--sm" : ""}`}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name] ?? PATHS.file} />
    </svg>
  );
}
