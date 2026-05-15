"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  expeditions: "Expeditions",
  photos: "Photos",
  profile: "Profile",
  upload: "Upload",
  create: "Create",
  edit: "Edit",
  steps: "Steps",
  login: "Log in",
  signup: "Sign up",
  about: "About",
  terms: "Terms of Use",
};

// Returns a human-readable label for a path segment given its parent segment.
function labelFor(segment: string, parent: string | undefined): string {
  if (LABELS[segment]) return LABELS[segment];
  // Dynamic ID segment — infer from parent context
  const singular: Record<string, string> = {
    photos: "Photo",
    expeditions: "Expedition",
    steps: "Step",
    profile: "Profile",
  };
  if (parent && singular[parent]) return singular[parent];
  return segment;
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const parent = segments[i - 1];
    const label = labelFor(segment, parent);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto max-w-5xl px-4 py-2 text-sm text-gray-500"
    >
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
        </li>
        {crumbs.map(({ href, label, isLast }) => (
          <li key={href} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            {isLast ? (
              <span className="text-gray-900" aria-current="page">
                {label}
              </span>
            ) : (
              <Link href={href} className="hover:text-gray-900">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
