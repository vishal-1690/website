import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Profile from "@/components/Profile";
import { site } from "@/content/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${site.profile.name} — ${site.profile.tagline}`,
    template: `%s — ${site.profile.name}`,
  },
  description: site.profile.intro,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* rem, not px, so the column scales with the root font size and the
            line length stays constant instead of shrinking as type grows.
            The avatar hangs outside this column via absolute positioning, so
            no gutter is reserved and no offset is needed below. */}
        <div className="mx-auto max-w-[45rem] px-5 py-14 sm:px-6 sm:py-20">
          {/* Outside template.tsx, so it stays still while pages blur in. */}
          <Profile />
          <main className="mt-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
