import { createFileRoute } from "@tanstack/react-router";
import { FileCheck2 } from "lucide-react";
import { InfoPage } from "../components/info-page";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Customer Terms | Onyn Pakistan" }] }),
  component: TermsPage,
});
function TermsPage() {
  return (
    <InfoPage
      eyebrow="LEGAL"
      title="Customer terms"
      description="Plain-language pilot terms for ordering food through Onyn Pakistan."
      updated="11 August 2026"
      icon={FileCheck2}
      notice="These terms are a launch-candidate draft and require approval from qualified Pakistan counsel before public trading."
      sections={[
        {
          title: "1. The service",
          paragraphs: [
            "Onyn provides a marketplace connecting customers with independent food businesses and, where offered, delivery riders. The restaurant prepares and supplies the food. Availability is limited to the zones shown at checkout.",
          ],
        },
        {
          title: "2. Accounts",
          bullets: [
            "Use your own Pakistan mobile number and protect access to it.",
            "Provide accurate delivery and landmark information.",
            "Do not create fraudulent orders, abuse promotions or misuse another person's account.",
          ],
        },
        {
          title: "3. Orders and prices",
          paragraphs: [
            "The final basket shows item prices, selected options, delivery and service fees in PKR before confirmation. The server rechecks price, stock, service area and opening status when the order is placed.",
          ],
          bullets: [
            "A restaurant may reject an order it cannot safely fulfil.",
            "Cash on delivery is the only pilot payment method.",
            "Online payment options are not available until separately approved.",
          ],
        },
        {
          title: "4. Cancellations",
          paragraphs: [
            "A placed order can be cancelled immediately through the app. After acceptance, cancellation requires support review because food preparation may have started. The cancellation and refunds policy forms part of these terms.",
          ],
        },
        {
          title: "5. Safety and conduct",
          paragraphs: [
            "Customers, partners and riders must behave lawfully and respectfully. Safety incidents should be reported immediately. Do not use the service for prohibited goods or unlawful activity.",
          ],
        },
        {
          title: "6. Service interruptions",
          paragraphs: [
            "We may pause ordering for safety, capacity, maintenance or incident response. We will preserve order and audit records required to resolve active transactions.",
          ],
        },
        {
          title: "7. Contact",
          paragraphs: [
            "Use the protected support page for account or order help. Final company identity, registered address and formal notices channel must be inserted before public launch.",
          ],
        },
      ]}
    />
  );
}
