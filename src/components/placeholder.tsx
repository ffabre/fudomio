import type { ReactNode } from "react";

export function Placeholder({
  children,
  scroll = false,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const message = (
    <p className="max-w-md text-center text-2xl leading-snug text-muted-foreground">
      {children}
    </p>
  );

  if (scroll) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center ps-6 pe-6 py-10">
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden ps-6 pe-6">
      {message}
    </div>
  );
}
