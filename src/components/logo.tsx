import * as React from "react";

export function Logo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M32 59C46.9117 59 59 46.9117 59 32C59 17.0883 46.9117 5 32 5C17.0883 5 5 17.0883 5 32C5 46.9117 17.0883 59 32 59Z"
        stroke="hsl(var(--primary))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 27H43L37.9926 36.9205C37.1354 38.5147 34.908 38.5147 34.0508 36.9205L32.2222 33.5556L30.1714 29.8095C29.7431 29.0124 28.7118 29.0124 28.2835 29.8095L26.3158 33.4737"
        stroke="hsl(var(--accent))"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
