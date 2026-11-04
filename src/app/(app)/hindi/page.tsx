import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { HindiToFrench } from "@/components/hindi-to-french";
import { Bi } from "@/components/bi";

export const metadata = { title: "Hindi → French" };
export const dynamic = "force-dynamic";

export default async function HindiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold"><Bi as="span" t={{ en: "Hindi → French", hi: "हिंदी से फ़्रेंच" }} /></h1>
        <Bi className="text-muted" t={{
          en: "Say anything the way you'd say it in Hindi. Get natural French, how to pronounce it in Devanagari, word by word meanings, and the mistakes Hindi speakers usually make.",
          hi: "जो भी कहना हो, हिंदी में वैसे ही कहें जैसे आप बोलते हैं। आपको मिलेगा सही फ़्रेंच वाक्य, देवनागरी में उसका उच्चारण, हर शब्द का मतलब, और हिंदी बोलने वालों की आम ग़लतियाँ।",
        }} />
      </header>
      <HindiToFrench />
    </div>
  );
}
