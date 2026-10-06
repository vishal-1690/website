import Avatar from "./Avatar";
import HireBubble from "./HireBubble";
import SegmentedNav from "./SegmentedNav";
import { site } from "@/content/site";

/**
 * The persistent header. Rendered by layout.tsx (outside template.tsx) so it
 * stays still while only the content below it blurs in on navigation.
 *
 * The avatar floats in the left margin only where that margin is wide enough to
 * hold it (the `avatar` breakpoint, 1320px), and stacks above the name anywhere
 * narrower — phones and tablets alike. See `.header-grid` in globals.css.
 */
export default function Profile() {
  const { profile } = site;
  const avatar = {
    src: profile.avatar,
    name: profile.name,
    initials: profile.initials,
  };

  return (
    <header>
      {/* `profile-top` is the part that slides up under the bar in the play
          state, leaving only its bottom edge (the "peek") above the tabs.
          `profile-slide` is what actually moves; the veil sits over the peek. */}
      <div className="profile-top">
        <div
          data-profile-slide
          className="profile-slide header-grid"
        >
          <div className="avatar-float hidden avatar:block">
            <HireBubble>
              <Avatar {...avatar} size={144} />
            </HireBubble>
          </div>

          <div className="min-w-0">
            <div className="mb-6 w-fit avatar:hidden">
              <HireBubble>
                <Avatar {...avatar} size={132} />
              </HireBubble>
            </div>

            <div className="flex items-center justify-between gap-4">
              <h1 className="text-xl font-medium text-foreground">
                {profile.greeting}
              </h1>

              {profile.resumeUrl && (
                <a
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-metal shrink-0 text-xs font-medium"
                >
                  Get my resume
                </a>
              )}
            </div>

            <p className="mt-5 text-base leading-[1.55] text-foreground text-pretty">
              {profile.intro}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-faint">
              {profile.skills.map((skill, i) => (
                <span key={skill}>
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  <span className="skill">{skill}</span>
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="dock-nav">
        <SegmentedNav />
      </div>
    </header>
  );
}
