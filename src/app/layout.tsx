import "../index.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Cafe QR Ph Ordering App",
  description:
    "Modern Cafe Web Ordering App featuring Category Menu, Floating Cart Drawer, PayMongo Dynamic QR Ph & Cash checkout, PayMongo Webhooks, Supabase Realtime sync, and Live Kitchen Display System (KDS).",
  openGraph: {
    title: "Cafe QR Ph Ordering App",
    description:
      "Modern Cafe Web Ordering App featuring Category Menu, Floating Cart Drawer, PayMongo Dynamic QR Ph & Cash checkout, PayMongo Webhooks, Supabase Realtime sync, and Live Kitchen Display System (KDS).",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
