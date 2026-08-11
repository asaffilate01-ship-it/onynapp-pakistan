import { createFileRoute } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { InfoPage } from "../components/info-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy | Onyn Pakistan" }] }),
  component: PrivacyPage,
});
function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="PRIVACY"
      title="Your information, used carefully."
      description="What the controlled Onyn Pakistan pilot collects, why it is needed and who can access it."
      updated="11 August 2026"
      icon={LockKeyhole}
      notice="This is a product-ready privacy draft, not legal advice. Retention periods, company/controller details and Pakistan counsel approval are launch gates."
      sections={[
        {
          title: "Information we collect",
          bullets: [
            "Mobile number and display name",
            "Saved delivery address, landmark and instructions",
            "Orders, selected menu options and status history",
            "Support requests and safety reports",
            "Partner or rider application information",
            "Security, device and operational audit information",
          ],
        },
        {
          title: "How we use it",
          bullets: [
            "Authenticate accounts and prevent abuse",
            "Check serviceability and fulfil orders",
            "Give the assigned restaurant and rider only the details they need",
            "Resolve complaints, cancellations and delivery incidents",
            "Reconcile COD and investigate fraud",
            "Measure reliability and improve the pilot",
          ],
        },
        {
          title: "Access controls",
          paragraphs: [
            "Customers see their own account and orders. Restaurant staff see assigned-branch orders according to role. Assigned riders see delivery details only for their jobs. Platform support and operations access is separately authorised and audited.",
          ],
        },
        {
          title: "Sharing",
          paragraphs: [
            "Information may be shared with the restaurant, assigned rider, communications provider and infrastructure processors only for delivering the service. We do not sell customer personal information.",
          ],
        },
        {
          title: "Retention and rights",
          paragraphs: [
            "We keep data only for an approved operational, legal, fraud-prevention or accounting purpose. Before launch, Onyn must publish exact retention periods and a verified route for access, correction, deletion and complaint requests.",
          ],
        },
        {
          title: "Security",
          bullets: [
            "Mobile OTP authentication",
            "Row-level database access controls",
            "Server-owned price and status transitions",
            "Separate platform and restaurant permissions",
            "Audit events for sensitive operational changes",
          ],
        },
      ]}
    />
  );
}
