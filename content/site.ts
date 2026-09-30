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
  /**
   * Not rendered on the page. Used for search results and link previews, which
   * truncate around 160 characters — keep it under that.
   */
  description: string;
  /** Absolute site URL, from SITE_URL. Needed for absolute OG image links. */
  url: string;
  /** Path in /public, or null to render the <Monogram /> fallback */
  avatar: string | null;
  /** Used by the monogram fallback */
  initials: string;
  /** Rendered as one muted line above the tabs. Keep it short. */
  skills: string[];
  /** When false the floating availability bubble is not rendered. */
  available: boolean;
  /** Bubble copy. Keep it to a few words — it sits on one line. */
  availableLabel: string;
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
  /** Slug of an image gallery in content/gallery.ts, shown as a stack under the date. */
  gallery?: string;
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
      "A senior frontend engineer with nearly seven years building interfaces for the web. Experienced, but still curious. Most of my attention goes to how an interface behaves once real data and real people reach it, and I'm now learning to build beyond the browser.",
    description:
      "Frontend engineer in Bengaluru with nearly seven years building interfaces for the web. Currently learning to build beyond the browser.",
    url: process.env.SITE_URL ?? "https://localhost:3000",
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
    available: true,
    availableLabel: "Open to work",
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
      gallery: "flipai",
      description:
        "An LLM-driven root cause analysis tool for SRE teams at large enterprises. Built the debugging surface: dense time-series charts you can brush-select to drive the analysis, several kinds of evidence rendered side by side, and an inline-widget system so the model could answer with interactive components instead of plain text.",
    },
    {
      company: "ChaiPoint",
      logo: "/chai_point_logo.jpg",
      role: "Senior UI Engineer",
      start: "2020-03",
      end: "2023-09",
      description:
        "A retail chain's product suite: in-store POS, back-office console, customer-facing ordering, plus a set of internal tools. I owned the frontend end to end on most of them. The POS was the interesting one. I led its rewrite onto an IndexedDB storage architecture, which is what let it keep taking orders with no network, with a FIFO queue syncing them up once it returned. A separate service-worker update flow handled getting new code onto the terminals.",
    },
    {
      company: "YouPlus",
      logo: null,
      role: "Frontend Engineer",
      start: "2019-07",
      end: "2020-02",
      description:
        "Built interactive dashboards and integrated REST APIs. A few of the prototypes I shipped here became production features.",
    },
  ],

  about: {
    heading: "About",
    paragraphs: [
      "I'm a frontend engineer in Bengaluru. Most of my work has been on small teams, where owning a surface end to end was simply the job: the architecture, the performance, and the product decisions in between.",
      "Most of that work comes down to making complicated systems legible. Retail operations have to keep running in unpredictable conditions, and they get used in ways nobody planned for. Debugging tools have to surface an enormous amount of data without burying the person reading it, which usually means enriching dull records until they say something useful.",
      "I think about this at the system level as much as the pixel level: how the pieces fit together, where the edges are, and what happens under load. I genuinely enjoy the unintended behaviour, both the ways a user will break something and the ways a product will break on its own.",
      "What I want next is to be a human interface engineer in the fullest sense of the term: to understand rendering and state management at their core, rather than through whichever library happens to be current. Then building an interface becomes something I can do on any platform I need to.",
    ],
  },
};
