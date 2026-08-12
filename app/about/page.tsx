import type { Metadata } from "next";
import CopyEmail from "@/components/CopyEmail";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  const { about, profile } = site;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
        <h2 className="text-base font-medium text-foreground">
          {about.heading}
        </h2>

        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {profile.emailUser && profile.emailDomain && (
            <CopyEmail
              user={profile.emailUser}
              domain={profile.emailDomain}
            />
          )}
          {profile.socials.map((social) => (
            <a
              key={social.href}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline text-xs text-muted hover:text-foreground"
            >
              {social.label} ↗
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {about.paragraphs.map((paragraph, i) => (
          <p key={i} className="text-base leading-[1.55] text-pretty text-muted">
            {paragraph}
          </p>
        ))}
      </div>

    </section>
  );
}
