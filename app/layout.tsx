import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mia Clarke swim times",
  description: "Private swim times, qualifying gaps and rankings for Mia Clarke.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
