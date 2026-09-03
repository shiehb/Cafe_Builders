import "../index.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Artisan Cafe",
  description: "Cafe ordering and kitchen operations",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
