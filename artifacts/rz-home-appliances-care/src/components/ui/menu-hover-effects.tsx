import type { AnchorHTMLAttributes, ReactNode } from 'react';

type MenuHoverLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  endContent?: ReactNode;
};

export function MenuHoverLink({
  children,
  className = '',
  endContent,
  ...props
}: MenuHoverLinkProps) {
  return (
    <a
      {...props}
      className={`group relative isolate overflow-hidden ${className}`}
    >
      <span className="relative z-10 flex items-center gap-2 transition-colors duration-300 group-hover:text-[hsl(210_40%_98%)] group-focus-visible:text-[hsl(210_40%_98%)]">
        {children}
      </span>
      {endContent ? (
        <span className="relative z-10 transition-colors duration-300 group-hover:text-[hsl(210_40%_98%)] group-focus-visible:text-[hsl(210_40%_98%)]">
          {endContent}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-0 origin-center scale-y-[2] border-y-2 border-[hsl(215_82%_38%)] opacity-0 transition-all duration-300 ease-out group-hover:scale-y-100 group-hover:opacity-100 group-focus-visible:scale-y-100 group-focus-visible:opacity-100"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[2px] bottom-0 z-0 origin-top scale-y-0 bg-[hsl(215_82%_38%)] opacity-0 transition-all duration-300 ease-out group-hover:scale-y-100 group-hover:opacity-100 group-focus-visible:scale-y-100 group-focus-visible:opacity-100"
      />
    </a>
  );
}