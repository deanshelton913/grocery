import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pantry Ledger",
  description: "Track your grocery spend and reduce waste",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#1F3329" }}>
        {children}
      </body>
    </html>
  );
}
