import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home Gym Designer",
  description: "Plan your home gym in accurate 2D and 3D: racks, mats, barbells, plates and clearances.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
