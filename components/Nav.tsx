"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  count?: number;
}

function active(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function Nav({ items, variant }: { items: NavItem[]; variant: "top" | "bottom" }) {
  const path = usePathname();
  return (
    <nav
      className={variant === "top" ? "shell-nav" : "shell-bottom"}
      aria-label="Main"
      style={variant === "bottom" ? { gridTemplateColumns: `repeat(${items.length}, 1fr)` } : undefined}
    >
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={active(path, it.href) ? "page" : undefined}>
          {variant === "bottom" ? <Icon name={it.icon} /> : null}
          {it.label}
          {it.count ? <span className="nav-count" aria-label={`${it.count} waiting`}>{it.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
