import type { Metadata } from "next";

// Pages de prévisualisation interne — jamais indexables.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DevLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
