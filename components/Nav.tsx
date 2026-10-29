"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const ITEMS = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/inbox", label: "Inbox", icon: "inbox" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/people", label: "People", icon: "users" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function Nav({ pending, variant }: { pending: number; variant: "top" | "bottom" }) {
  const path = usePathname();
  return (
    <nav className={variant === "top" ? "shell-nav" : "shell-bottom"} aria-label="Main">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href} aria-current={active(path, it.href) ? "page" : undefined}>
          {variant === "bottom" ? <Icon name={it.icon} /> : null}
          {it.label}
          {it.href === "/inbox" && pending > 0 ? (
            <span className="nav-count" aria-label={`${pending} waiting`}>{pending}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
