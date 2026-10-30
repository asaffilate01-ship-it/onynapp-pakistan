import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { InfoPage } from "../components/info-page";

export const Route = createFileRoute("/refunds")({
  head: () => ({ meta: [{ title: "Cancellations and Refunds | Dishbee+ Pakistan" }] }),
  component: RefundsPage,
});
function RefundsPage() {
  return (
    <InfoPage
      eyebrow="ORDER HELP"
      title="Cancellations and refunds"
      description="What happens when plans change or an order goes wrong during the COD pilot."
      updated="11 August 2026"
      icon={ReceiptText}
      notice="Cash refunds and compensation need an approved operations owner and ledger before real pilot orders begin."
      sections={[
        {
          title: "Before the restaurant accepts",
          paragraphs: [
            "You can cancel a newly placed order immediately from order tracking. The cancellation is recorded in the order history.",
          ],
        },
        {
          title: "After acceptance",
          paragraphs: [
            "Once preparation starts, the app creates a support review rather than silently cancelling. The restaurant's work, food-safety position, rider status and reason will be considered.",
          ],
        },
        {
          title: "Missing, incorrect or unsafe food",
          bullets: [
            "Report the issue as soon as possible through support.",
            "Keep the food, packaging and photographs where safe to do so.",
            "For an immediate safety risk, stop consuming the food and seek appropriate medical or emergency help.",
            "Support records the outcome and any approved compensation.",
          ],
        },
        {
          title: "Cash on delivery",
          paragraphs: [
            "If the order is cancelled before delivery, no cash should be collected. Where cash has already been collected, an approved refund must be recorded and acknowledged; riders and restaurants must not make undocumented adjustments.",
          ],
        },
        {
          title: "Pilot response targets",
          bullets: [
            "Safety issue: immediate priority queue",
            "Active delivery issue: target first response within 10 minutes during staffed pilot hours",
            "Other order issue: target first response within 2 staffed hours",
            "Account/general issue: target first response within one business day",
          ],
        },
      ]}
    />
  );
}
