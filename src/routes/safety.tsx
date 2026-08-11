import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { InfoPage } from "../components/info-page";

export const Route = createFileRoute("/safety")({
  head: () => ({ meta: [{ title: "Safety | Onyn Pakistan" }] }),
  component: SafetyPage,
});
function SafetyPage() {
  return (
    <InfoPage
      eyebrow="SAFETY"
      title="Safety comes before speed."
      description="Practical guidance for customers, restaurants and riders in the controlled Lahore pilot."
      icon={ShieldAlert}
      sections={[
        {
          title: "Customers",
          bullets: [
            "Use accurate address and landmark information.",
            "Keep children and pets away from the handover point.",
            "Check allergy information directly with the restaurant; the pilot does not yet certify allergen data.",
            "Report sealed-package damage, suspected tampering or unsafe food immediately.",
          ],
        },
        {
          title: "Restaurants and home chefs",
          bullets: [
            "Accept only orders you can prepare safely within capacity.",
            "Maintain required food registrations, hygiene controls and allergen processes.",
            "Use tamper-evident packaging and keep hot and cold food appropriately separated.",
            "Record rejection and incident reasons truthfully.",
          ],
        },
        {
          title: "Riders",
          bullets: [
            "Never use the app while a vehicle is moving.",
            "Wear lawful protective equipment and follow road rules.",
            "Do not enter unsafe premises; contact operations for a safe handover.",
            "Never mark an order delivered without actual handover and proof.",
          ],
        },
        {
          title: "Urgent situations",
          paragraphs: [
            "Onyn support is not an emergency service. Contact the appropriate Pakistan emergency service where there is immediate danger, then preserve relevant order details and report the incident through the safety category.",
          ],
        },
      ]}
    />
  );
}
