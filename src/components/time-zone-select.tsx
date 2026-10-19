"use client";
import { useEffect, useId, useMemo, useState } from "react";

/**
 * Common places, labelled by country and city in English and Hindi. The value is always an IANA
 * city zone, so daylight-saving changes follow that city's rules. This is a curated list, not an atlas.
 */
const COMMON: [zone: string, en: string, hi: string][] = [
  ["Asia/Kolkata", "India: New Delhi, Mumbai, Kolkata", "भारत: नई दिल्ली, मुंबई, कोलकाता"],
  ["America/Toronto", "Canada: Toronto, Montréal, Ottawa", "कनाडा: टोरंटो, मॉन्ट्रियल, ओटावा"],
  ["America/Vancouver", "Canada: Vancouver", "कनाडा: वैंकूवर"],
  ["America/Edmonton", "Canada: Edmonton, Calgary", "कनाडा: एडमंटन, कैलगरी"],
  ["America/Winnipeg", "Canada: Winnipeg", "कनाडा: विनिपेग"],
  ["America/Regina", "Canada: Regina, Saskatoon", "कनाडा: रेजाइना, सस्काटून"],
  ["America/Halifax", "Canada: Halifax", "कनाडा: हैलिफ़ैक्स"],
  ["America/Moncton", "Canada: Moncton", "कनाडा: मॉन्क्टन"],
  ["America/St_Johns", "Canada: St. John's", "कनाडा: सेंट जॉन्स"],
  ["America/New_York", "United States: New York", "अमेरिका: न्यूयॉर्क"],
  ["America/Chicago", "United States: Chicago", "अमेरिका: शिकागो"],
  ["America/Denver", "United States: Denver", "अमेरिका: डेनवर"],
  ["America/Los_Angeles", "United States: Los Angeles", "अमेरिका: लॉस एंजेलिस"],
  ["Europe/Paris", "France: Paris", "फ़्रांस: पेरिस"],
  ["Europe/Brussels", "Belgium: Brussels", "बेल्जियम: ब्रसेल्स"],
  ["Europe/Zurich", "Switzerland: Zurich, Geneva", "स्विट्ज़रलैंड: ज़्यूरिख़, जिनेवा"],
  ["Europe/London", "United Kingdom: London", "ब्रिटेन: लंदन"],
  ["Europe/Berlin", "Germany: Berlin", "जर्मनी: बर्लिन"],
  ["Asia/Dubai", "United Arab Emirates: Dubai", "संयुक्त अरब अमीरात: दुबई"],
  ["Asia/Karachi", "Pakistan: Karachi, Lahore", "पाकिस्तान: कराची, लाहौर"],
  ["Asia/Kathmandu", "Nepal: Kathmandu", "नेपाल: काठमांडू"],
  ["Asia/Dhaka", "Bangladesh: Dhaka", "बांग्लादेश: ढाका"],
  ["Asia/Colombo", "Sri Lanka: Colombo", "श्रीलंका: कोलंबो"],
  ["Asia/Singapore", "Singapore", "सिंगापुर"],
  ["Australia/Sydney", "Australia: Sydney, Melbourne", "ऑस्ट्रेलिया: सिडनी, मेलबर्न"],
  ["Pacific/Auckland", "New Zealand: Auckland", "न्यूज़ीलैंड: ऑकलैंड"],
  ["UTC", "UTC (no daylight saving)", "UTC (समय में कोई मौसमी बदलाव नहीं)"],
];
/** Older names some browsers report; treated as the zone they point to. */
const ALIASES: Record<string, string> = { "Asia/Calcutta": "Asia/Kolkata", "Asia/Katmandu": "Asia/Kathmandu" };

/** Searchable country/city picker shared by onboarding and Settings. */
export function TimeZoneSelect({ value, onChange }: { value: string; onChange: (zone: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [all, setAll] = useState<string[]>([]);
  const [device, setDevice] = useState<string | null>(null);
  useEffect(() => {
    try { setAll(Intl.supportedValuesOf("timeZone")); } catch { /* older browsers: the common list still works */ }
    try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; setDevice(ALIASES[z] ?? z); } catch { /* ignore */ }
  }, []);
  const options = useMemo(() => {
    const labels = new Map(COMMON.map(([z, en, hi]) => [z, `${en} · ${hi}`]));
    const zones = [...new Set([...COMMON.map(([z]) => z), ...all.filter((z) => !ALIASES[z]), value])];
    return zones.map((z) => ({ zone: z, label: labels.get(z) ?? z.replaceAll("_", " ").replace("/", ": ") }));
  }, [all, value]);
  const q = query.trim().toLocaleLowerCase();
  const matches = q ? options.filter((o) => `${o.label} ${o.zone}`.toLocaleLowerCase().includes(q)) : options;
  // The current choice always stays in the list, so filtering never changes it silently.
  const shown = matches.some((o) => o.zone === value) ? matches : [options.find((o) => o.zone === value)!, ...matches];
  return (
    <div className="space-y-1.5 text-sm">
      <label htmlFor={`${id}-q`} className="block font-medium">Find your country or city <span lang="hi" className="deva font-normal text-muted">· अपना देश या शहर खोजें</span></label>
      <input id={`${id}-q`} type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="India, Canada, Toronto, भारत…" autoComplete="off" />
      <label htmlFor={`${id}-z`} className="block font-medium">Time zone <span lang="hi" className="deva font-normal text-muted">· समय क्षेत्र</span></label>
      <select id={`${id}-z`} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {shown.map((o) => <option key={o.zone} value={o.zone}>{o.label}</option>)}
      </select>
      {q && matches.length === 0 && <p role="status" className="text-muted">No match. Your time zone has not changed. <span lang="hi" className="deva">कुछ नहीं मिला। आपका समय क्षेत्र नहीं बदला है।</span></p>}
      {device && device !== value && (
        <button type="button" className="underline" onClick={() => { onChange(device); setQuery(""); }}>
          Use this device&apos;s time zone ({device.replaceAll("_", " ")}) <span lang="hi" className="deva">· इस डिवाइस का समय क्षेत्र चुनें</span>
        </button>
      )}
      <p className="text-xs text-muted">Your study days follow the local date in this place. Pick a city near you: some countries have several time zones. <span lang="hi" className="deva">आपके पढ़ाई के दिन इसी जगह की तारीख़ से चलते हैं। अपने पास का शहर चुनें, क्योंकि कुछ देशों में कई समय क्षेत्र होते हैं।</span></p>
    </div>
  );
}
