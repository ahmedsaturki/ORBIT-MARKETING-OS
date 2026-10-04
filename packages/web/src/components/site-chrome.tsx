import type { ReactElement } from "react";
import Link from "next/link";

/**
 * Site-wide navigation and release footer.
 *
 * These were previously inlined in the homepage only, so /pricing and the
 * /legal pages rendered <main> with no banner, navigation or contentinfo
 * landmark (WCAG 1.3.1). Extracting them here and rendering them from every
 * page fixes that without restyling anything: the class names and markup are
 * exactly what the homepage already used.
 */

const links = [
  { href: "/pricing/", label: "الأسعار" },
  { href: "/legal/privacy/", label: "الخصوصية" },
  { href: "/legal/terms/", label: "الشروط" },
  { href: "/legal/refunds/", label: "الاسترداد" },
  { href: "/legal/eula/", label: "EULA" },
];

export function SiteHeader(): ReactElement {
  return (
    <header className="topbar">
      <div className="container nav">
        <strong>ORBIT</strong>
        <nav aria-label="التنقل الرئيسي">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

const declaredReleaseSha = process.env.NEXT_PUBLIC_ORBIT_RELEASE_SHA?.trim();
const vercelGitCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
export const releaseSha =
  declaredReleaseSha || vercelGitCommitSha || "unreleased";
const releaseShaSource = declaredReleaseSha
  ? "NEXT_PUBLIC_ORBIT_RELEASE_SHA"
  : vercelGitCommitSha
    ? "VERCEL_GIT_COMMIT_SHA"
    : "none";

export function SiteFooter(): ReactElement {
  return (
    <footer className="container footer" aria-label="معلومات الإصدار">
      ORBIT Marketing OS • v1.0.0 • Local-first • إصدار:{" "}
      <code data-release-source={releaseShaSource}>
        {releaseSha === "unreleased" ? "غير منشور" : releaseSha.slice(0, 12)}
      </code>
    </footer>
  );
}
