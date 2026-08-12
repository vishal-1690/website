/**
 * All editable site content lives here — this file and the env vars it reads
 * are the only things to touch when updating the site.
 */

export interface Social {
  label: string;
  href: string;
}

export interface Profile {
  name: string;
  /** The page heading, e.g. "Hi, i'm Ada" */
  greeting: string;
  /** Not rendered on the page — used for the browser tab title. */
  tagline: string;
  intro: string;
  /** Path in /public, or null to render the <Monogram /> fallback */
  avatar: string | null;
  /** Used by the monogram fallback */
  initials: string;
  /** Rendered as one muted line above the tabs. Keep it short. */
  skills: string[];
  /**
   * Read from the RESUME_PUBLIC_LINK env var. When unset the resume button is
   * not rendered at all. Read at build time — this is a static site, so
   * changing it requires a rebuild.
   */
  resumeUrl: string | undefined;
  /**
   * Split into user/domain and read from CONTACT_EMAIL_USER and
   * CONTACT_EMAIL_DOMAIN, so the full address is never rendered into the HTML.
   * When either is unset the copy-email control is not rendered.
   */
  emailUser: string | undefined;
  emailDomain: string | undefined;
  socials: Social[];
}

export interface Experience {
  company: string;
  /** Path in /public, or null to render the generated <LogoMark /> tile */
  logo: string | null;
  role: string;
  /** "YYYY-MM" — stored once, display is derived via formatRange() */
  start: string;
  /** "YYYY-MM", or null for "present" */
  end: string | null;
  description: string;
  url?: string;
}

export interface AboutContent {
  heading: string;
  /** Each string renders as one <p> */
  paragraphs: string[];
}

export interface SiteContent {
  profile: Profile;
  experience: Experience[];
  about: AboutContent;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2022-03" -> "Mar '22" */
function formatMonth(value: string): string {
  const [year, month] = value.split("-");
  const index = Number(month) - 1;
  const name = MONTHS[index] ?? month;
  return `${name} '${year.slice(2)}`;
}

/** "2022-03" + null -> "Mar '22 — present" */
export function formatRange(start: string, end: string | null): string {
  return `${formatMonth(start)} — ${end ? formatMonth(end) : "present"}`;
}

export const site: SiteContent = {
  profile: {
    name: "Vishal Gowda",
    greeting: "Hi, i'm Vishal",
    tagline: "Senior Frontend Engineer",
    intro:
      "A senior frontend engineer with ~7 years of building and remixing " +
      "interfaces on the web — experienced, but still curious. I care about " +
      "the details that make something feel right rather than merely work, " +
      "and I'm currently learning to build for platforms beyond the browser.",
    avatar: "/profile-picture.JPG",
    initials: "VG",
    // Kept deliberately short — the strongest signals only, not the full list.
    skills: [
      "TypeScript",
      "React",
      "Next.js",
      "Chart.js",
      "React Flow",
      "Playwright",
      "Node",
      "Postgres",
    ],
    resumeUrl: process.env.RESUME_PUBLIC_LINK,
    emailUser: process.env.CONTACT_EMAIL_USER,
    emailDomain: process.env.CONTACT_EMAIL_DOMAIN,
    // Only rendered when the env var is set, so an unconfigured deploy shows
    // no dead links.
    socials: [{ label: "LinkedIn", href: process.env.LINKEDIN_URL }].flatMap(
      ({ label, href }) => (href ? [{ label, href }] : []),
    ),
  },

  experience: [
    {
      company: "FlipAI",
      logo: "/flipai_logo.jpg",
      role: "Senior Frontend Engineer",
      start: "2023-09",
      end: "2026-06",
      description:
        "An LLM-driven root cause analysis tool for SRE teams at large " +
        "enterprises. Built a dense, data-heavy debugging surface — " +
        "brush-selectable time-series charts, many kinds of evidence rendered " +
        "side by side, and an inline-widget system letting the model answer " +
        "with interactive components instead of text.",
    },
    {
      company: "ChaiPoint",
      logo: "/chai_point_logo.jpg",
      role: "Senior UI Engineer",
      start: "2020-03",
      end: "2023-09",
      description:
        "A retail chain's product suite: in-store POS, back-office console, " +
        "customer-facing ordering, and a long tail of internal tools. I owned " +
        "the frontend end-to-end on most of them, and architected the " +
        "offline-first POS that keeps taking orders with no network — " +
        "IndexedDB state, a FIFO sync queue, service-worker cache " +
        "invalidation — then led its rewrite.",
    },
    {
      company: "YouPlus",
      logo: null,
      role: "Frontend Engineer",
      start: "2019-07",
      end: "2020-02",
      description:
        "Built interactive dashboards and integrated REST APIs. Shipped " +
        "functional prototypes that were promoted to production features.",
    },
  ],

  about: {
    heading: "About",
    paragraphs: [
      "I'm a frontend engineer in Bengaluru. Most of my work has been on small " +
      "teams where owning a surface end-to-end — architecture, performance, " +
      "and the product calls in between — was simply the job.",
      "The thread running through it is making complicated systems legible. " +
      "Retail operations that have to keep running in unpredictable " +
      "environments, used in ways nobody planned for. Tools that surface an " +
      "enormous amount of data and have to protect the user from the noise " +
      "in it — enriching the boring parts until they actually say something.",
      "I think about this at the system level as much as the pixel level: how " +
      "the pieces fit, where the edges are, what happens under load. The " +
      "unintended behaviour is the part I look forward to — the ways a user " +
      "will break something, and the ways the product will break on its own.",
      "I want to be a human interface engineer in the real sense of it. That " +
      "means understanding rendering and state management at the core, not " +
      "through the lens of whichever library is current — so that building " +
      "an interface is something I can do on any platform, not just the one " +
      "I happen to know.",
    ],
  },
};
