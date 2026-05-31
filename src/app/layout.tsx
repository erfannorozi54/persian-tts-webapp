import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Persian TTS",
  description: "Text-to-Speech synthesis with multiple AI models",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
