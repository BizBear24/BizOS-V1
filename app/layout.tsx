import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BizOS",
  description: "Minimal business intelligence consultant for uploaded CSV and Excel activity data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
