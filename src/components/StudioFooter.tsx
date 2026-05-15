import type { ReactNode } from "react";

type Props = {
  productName: string;
  tagline: string;
  icon: ReactNode;
  /** CSS variable name for icon color (e.g. "--pink"). */
  iconColorVar?: string;
};

export function StudioFooter({ productName, tagline, icon, iconColorVar = "--pink" }: Props) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="w-full"
      style={{
        background: "var(--footer-bg)",
        color: "var(--footer-text)",
      }}
    >
      <div className="mx-auto max-w-[880px] px-5">
        <hr style={{ borderColor: "var(--footer-rule)", borderTopWidth: 1, margin: 0 }} />
        <div style={{ paddingTop: 64 }}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="text-2xl leading-none"
              style={{ color: `var(${iconColorVar})` }}
            >
              {icon}
            </span>
            <h2
              className="m-0 text-[24px] font-bold"
              style={{ fontFamily: "var(--font-serif)", color: "var(--footer-text)" }}
            >
              {productName}
            </h2>
          </div>
          <p
            className="text-[16px]"
            style={{
              marginTop: 12,
              fontFamily: "var(--font-body)",
              color: "var(--footer-text-soft)",
            }}
          >
            {tagline}
          </p>
          <p
            className="text-[14px]"
            style={{
              marginTop: 20,
              fontFamily: "var(--font-body)",
              color: "var(--footer-text-faint)",
            }}
          >
            A <a href="http://shotsongoal.studio" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Shots on Goal Studio</a> product
          </p>
        </div>
        <hr
          style={{
            borderColor: "var(--footer-rule)",
            borderTopWidth: 1,
            margin: 0,
            marginTop: 48,
          }}
        />
        <p
          className="text-[14px]"
          style={{
            marginTop: 20,
            paddingBottom: 40,
            fontFamily: "var(--font-body)",
            color: "var(--footer-text-faint)",
          }}
        >
          © {year} <a href="http://shotsongoal.studio" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Shots on Goal Studio</a>, LLC. {productName} is a product of <a href="http://shotsongoal.studio" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Shots on Goal Studio</a>.
        </p>
      </div>
    </footer>
  );
}
