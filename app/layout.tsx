import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATM Pulse Check",
  description: "Internal team pulse survey",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
