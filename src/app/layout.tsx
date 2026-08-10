import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OTC Symptom Relief Assistant",
  description:
    "Informational OTC medication suggestions based on symptoms and safety exceptions. Not medical advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
