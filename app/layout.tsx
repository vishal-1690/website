import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

const { profile } = site;
const title = `${profile.name} — ${profile.tagline}`;

export const metadata: Metadata = {
  // Resolves the relative image paths below into the absolute URLs that
  // link-preview crawlers require.
  metadataBase: new URL(profile.url),
  title: {
    default: title,
    template: `%s — ${profile.name}`,
  },
  description: profile.description,
  // The profile picture doubles as the link preview image.
  icons: { icon: profile.avatar ?? undefined },
  openGraph: {
    type: "profile",
    title,
    description: profile.description,
    url: "/",
    siteName: profile.name,
    // Width/height matter: several crawlers skip the preview entirely rather
    // than download the image to measure it.
    images: profile.avatar
      ? [
          {
            url: profile.avatar,
            width: 896,
            height: 896,
            alt: profile.name,
          },
        ]
      : undefined,
  },
  twitter: {
    card: "summary",
    title,
    description: profile.description,
    images: profile.avatar ? [profile.avatar] : undefined,
  },
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
        <Analytics />
      </body>
    </html>
  );
}
