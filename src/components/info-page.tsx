import { AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import { LaunchHero, LaunchShell } from "./launch-shell";

export type InfoSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export function InfoPage({
  eyebrow,
  title,
  description,
  updated,
  sections,
  notice,
  icon: Icon = CheckCircle2,
}: {
  eyebrow: string;
  title: string;
  description: string;
  updated?: string;
  sections: InfoSection[];
  notice?: string;
  icon?: LucideIcon;
}) {
  return (
    <LaunchShell>
      <LaunchHero eyebrow={eyebrow} title={title} description={description} />
      <div className="info-layout">
        <aside>
          <Icon />
          <strong>{updated ? `Updated ${updated}` : "Controlled Lahore pilot"}</strong>
          <p>Questions can be submitted through the protected support route.</p>
          <a href="/support">Contact support</a>
        </aside>
        <article className="info-article">
          {notice && (
            <div className="info-notice">
              <AlertTriangle />
              <p>{notice}</p>
            </div>
          )}
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </LaunchShell>
  );
}
