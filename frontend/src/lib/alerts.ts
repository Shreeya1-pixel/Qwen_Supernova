import type { Action } from "./mesh";

export type AlertLang = "en" | "ar" | "hi" | "ur" | "ml" | "tl" | "ta" | "bn";
export const RTL_LANGS = new Set<AlertLang>(["ar", "ur"]);

export const ACTION_TEXT: Record<Action, Record<AlertLang, string>> = {
  stop: {
    en: "Stop work. Go to the shade now.",
    ar: "أوقف العمل، اذهب إلى الظل الآن",
    hi: "काम रोकें, अभी छाँव में जाएँ",
    ur: "کام روکیں، ابھی سائے میں جائیں",
    ml: "ജോലി നിർത്തുക, ഉടൻ തണലിലേക്ക് പോകുക",
    tl: "Itigil ang trabaho, pumunta sa lilim ngayon",
    ta: "வேலையை நிறுத்துங்கள், உடனே நிழலுக்குச் செல்லுங்கள்",
    bn: "কাজ থামান, এখনই ছায়ায় যান",
  },
  water: {
    en: "Drink water — one cup, now.",
    ar: "اشرب الماء — كوباً الآن",
    hi: "पानी पिएँ — अभी एक गिलास",
    ur: "پانی پئیں — ابھی ایک گلاس",
    ml: "വെള്ളം കുടിക്കുക — ഇപ്പോൾ ഒരു ഗ്ലാസ്",
    tl: "Uminom ng tubig — isang baso ngayon",
    ta: "தண்ணீர் குடியுங்கள் — இப்போது ஒரு குவளை",
    bn: "পানি পান করুন — এখনই এক গ্লাস",
  },
  shade: {
    en: "Rest in the shade for 15 minutes.",
    ar: "استرح في الظل ١٥ دقيقة",
    hi: "15 मिनट छाँव में आराम करें",
    ur: "15 منٹ سائے میں آرام کریں",
    ml: "15 മിനിറ്റ് തണലിൽ വിശ്രമിക്കുക",
    tl: "Magpahinga sa lilim nang 15 minuto",
    ta: "15 நிமிடம் நிழலில் ஓய்வெடுங்கள்",
    bn: "১৫ মিনিট ছায়ায় বিশ্রাম নিন",
  },
  buddy: {
    en: "Check on the person next to you.",
    ar: "اطمئن على زميلك",
    hi: "अपने साथी की जाँच करें",
    ur: "اپنے ساتھی کو دیکھیں",
    ml: "നിങ്ങളുടെ കൂട്ടുകാരനെ ശ്രദ്ധിക്കുക",
    tl: "Tingnan ang iyong kasama",
    ta: "உங்கள் சக ஊழியரைக் கவனியுங்கள்",
    bn: "আপনার সঙ্গীর খোঁজ নিন",
  },
  flood: {
    en: "Move to high ground — flash flood risk.",
    ar: "انتقل إلى مكان مرتفع — خطر سيول",
    hi: "ऊँची जगह पर जाएँ — बाढ़ का ख़तरा",
    ur: "اونچی جگہ پر جائیں — سیلاب کا خطرہ",
    ml: "ഉയർന്ന സ്ഥലത്തേക്ക് മാറുക — വെള്ളപ്പൊക്ക സാധ്യത",
    tl: "Pumunta sa mataas na lugar — may banta ng baha",
    ta: "உயரமான இடத்துக்குச் செல்லுங்கள் — வெள்ள அபாயம்",
    bn: "উঁচু জায়গায় যান — বন্যার ঝুঁকি",
  },
  dust: {
    en: "Masks on. Stop cranes and vehicles.",
    ar: "ضع الكمامة، أوقف الرافعات والمركبات",
    hi: "मास्क पहनें, क्रेन और गाड़ी रोकें",
    ur: "ماسک پہنیں، کرین اور گاڑی روکیں",
    ml: "മാസ്ക് ധരിക്കുക, ക്രെയിനും വാഹനവും നിർത്തുക",
    tl: "Magsuot ng mask, itigil ang crane at sasakyan",
    ta: "முகக்கவசம் அணியுங்கள், கிரேன், வாகனத்தை நிறுத்துங்கள்",
    bn: "মাস্ক পরুন, ক্রেন ও গাড়ি থামান",
  },
  clear: {
    en: "All clear. Work can resume.",
    ar: "زال الخطر، استأنف العمل",
    hi: "ख़तरा टल गया, काम शुरू करें",
    ur: "خطرہ ٹل گیا، کام شروع کریں",
    ml: "അപകടം കഴിഞ്ഞു, ജോലി തുടരാം",
    tl: "Ligtas na, ituloy ang trabaho",
    ta: "ஆபத்து நீங்கியது, வேலையைத் தொடருங்கள்",
    bn: "বিপদ কেটে গেছে, কাজ শুরু করুন",
  },
};

export const GOT_IT: Record<AlertLang, string> = {
  en: "Got it",
  ar: "فهمت",
  hi: "समझ गया",
  ur: "سمجھ گیا",
  ml: "മനസ്സിലായി",
  tl: "Nakuha ko",
  ta: "புரிந்தது",
  bn: "বুঝেছি",
};

export const ACTION_LABEL: Record<Action, string> = {
  stop: "Stop work",
  water: "Water break",
  shade: "Shade rest",
  buddy: "Buddy check",
  flood: "High ground",
  dust: "Dust",
  clear: "All clear",
};

/** Default crew on the demo phones, matching the backend's Dubai South roster. */
export const PHONES: { slot: number; name: string; lang: AlertLang }[] = [
  { slot: 0, name: "Site office", lang: "en" },
  { slot: 1, name: "Ravi", lang: "hi" },
  { slot: 2, name: "Joseph", lang: "ml" },
  { slot: 3, name: "Maria", lang: "tl" },
  { slot: 4, name: "Khalid", lang: "ar" },
];
