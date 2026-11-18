export type NavItem = { href: string; label: string; hi: string; icon: string };
export type NavGroup = { title: { en: string; hi: string }; items: NavItem[] };

/** Sidebar, mobile menu and the jump palette share this list so destinations stay in one place. */
export const NAV_GROUPS: NavGroup[] = [
  { title: { en: "Learn", hi: "सीखें" }, items: [
    { href: "/today", label: "Today", hi: "आज", icon: "☀️" },
    { href: "/hindi", label: "Hindi → French", hi: "हिंदी से फ़्रेंच", icon: "🔤" },
    { href: "/course", label: "Course map", hi: "पाठ्यक्रम", icon: "🗺️" },
    { href: "/review", label: "Review", hi: "दोहराव", icon: "🔁" },
    { href: "/play", label: "Practice games", hi: "अभ्यास के खेल", icon: "🎯" },
    { href: "/dictionary", label: "Dictionary", hi: "शब्दकोश", icon: "📖" },
    { href: "/words", label: "My words", hi: "मेरे शब्द", icon: "⭐" },
  ] },
  { title: { en: "Practise", hi: "अभ्यास" }, items: [
    { href: "/pronunciation", label: "Pronunciation lab", hi: "उच्चारण लैब", icon: "👄" },
    { href: "/speaking", label: "Speaking tutor", hi: "बोलने का अभ्यास", icon: "🗣️" },
    { href: "/writing", label: "Writing studio", hi: "लेखन स्टूडियो", icon: "✍️" },
    { href: "/listening", label: "Listening library", hi: "सुनने का अभ्यास", icon: "🎧" },
    { href: "/reading", label: "Reading library", hi: "पढ़ने का अभ्यास", icon: "📰" },
    { href: "/discover", label: "Web discovery", hi: "वेब से सीखें", icon: "🔎" },
  ] },
  { title: { en: "TEF", hi: "TEF" }, items: [
    { href: "/exam", label: "TEF practice & mocks", hi: "TEF परीक्षा अभ्यास", icon: "📝" },
    { href: "/resources", label: "Free resources", hi: "मुफ़्त संसाधन", icon: "🧭" },
  ] },
  { title: { en: "You", hi: "आप" }, items: [
    { href: "/mistakes", label: "Mistake notebook", hi: "ग़लतियों की कॉपी", icon: "📒" },
    { href: "/progress", label: "Progress", hi: "प्रगति", icon: "📈" },
    { href: "/settings", label: "Settings", hi: "सेटिंग्स", icon: "⚙️" },
    { href: "/privacy", label: "Privacy", hi: "गोपनीयता", icon: "🔒" },
  ] },
];
