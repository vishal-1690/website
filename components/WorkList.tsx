import WorkRow from "./WorkRow";
import { site } from "@/content/site";

export default function WorkList() {
  const { experience } = site;

  return (
    <section aria-label="Work experience" className="divide-y divide-border">
      {experience.map((item) => (
        <WorkRow key={`${item.company}-${item.start}`} item={item} />
      ))}
    </section>
  );
}
