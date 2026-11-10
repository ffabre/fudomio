"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export type AppNavItem = {
  href: string;
  label: string;
};

export function AppNav({
  items,
  label,
  orientation,
  className,
}: {
  items: readonly AppNavItem[];
  label: string;
  orientation: "horizontal" | "vertical";
  className?: string;
}) {
  const pathname = usePathname();
  const horizontal = orientation === "horizontal";

  return (
    <nav aria-label={label} className={className}>
      <ul
        className={cn(
          "m-0 flex list-none gap-1 p-0",
          horizontal ? "flex-row flex-wrap" : "flex-col",
        )}
      >
        {items.map((item) => {
          const active = pathname === item.href;

          return (
            <li
              key={item.href}
              className={horizontal ? "min-w-0 flex-1" : "w-full"}
            >
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-auto min-h-11 w-full max-w-full shrink py-2 text-base whitespace-normal",
                  horizontal
                    ? "justify-center ps-2 pe-2 text-center"
                    : "justify-start ps-3 pe-3 text-start",
                  active &&
                    "bg-sidebar-accent font-semibold text-primary hover:bg-sidebar-accent hover:text-primary",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
