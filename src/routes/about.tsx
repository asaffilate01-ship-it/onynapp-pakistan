import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { InfoPage } from "../components/info-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Dishbee+ Pakistan" },
      {
        name: "description",
        content: "Why Dishbee+ is building a fairer Pakistan food marketplace.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <InfoPage
      eyebrow="ABOUT DISHBEE+"
      title="Local food should work better for everyone."
      description="Dishbee+ Pakistan is being built for independent restaurants, home chefs, customers and riders, starting with a controlled Lahore pilot."
      icon={Building2}
      sections={[
        {
          title: "Our model",
          paragraphs: [
            "We plan to charge restaurant partners a predictable subscription instead of a Dishbee+ percentage commission on each sale. Delivery, payment-processing and subscription costs will still be disclosed clearly.",
          ],
          bullets: [
            "Customer fees shown before confirmation",
            "Restaurant-owned menu and operating controls",
            "Pakistan-only support and service design",
            "Measured city-by-city expansion",
          ],
        },
        {
          title: "Why a controlled pilot",
          paragraphs: [
            "Food delivery is an operational service, not only a website. The Lahore COD pilot lets us prove restaurant acceptance, preparation, rider handover, delivery, support and cash reconciliation before opening more cities or payment methods.",
          ],
        },
        {
          title: "What is not live yet",
          bullets: [
            "Karachi, Islamabad and Rawalpindi ordering",
            "Online cards, JazzCash, Easypaisa and Raast",
            "Grocery, pharmacy and courier ordering",
            "Subscriptions, vouchers and loyalty rewards",
          ],
        },
      ]}
    />
  );
}
