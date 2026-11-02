import type { Snapshot, Worker } from "./api";
import type { Lang } from "./i18n";

export const NAME_AR: Record<string, string> = {
  Ravi: "رافي",
  Ahmed: "أحمد",
  Joseph: "جوزيف",
  Maria: "ماريا",
  Senthil: "سينثيل",
  Khalid: "خالد",
  Rahim: "رحيم",
};

export const SIGNAL_AR: Record<string, string> = {
  "wet-bulb temperature": "حرارة البصيلة الرطبة",
  "dust (PM10)": "الغبار",
  "air quality index": "جودة الهواء",
  "sea-surface temperature": "حرارة سطح البحر",
};

const isHer = (w: Worker) => w.role === "site nurse";

function clockAfter(localIso: string, hours: number) {
  const d = new Date(localIso);
  d.setHours(d.getHours() + hours);
  return d.toTimeString().slice(0, 5);
}

/** The front-page headline, written from the snapshot rather than from a template slot. */
export function headline(s: Snapshot, lang: Lang = "en"): { title: string; deck: string } {
  const crossing = s.crew
    .filter((w) => w.eta_hours !== null)
    .sort((a, b) => (a.eta_hours ?? 99) - (b.eta_hours ?? 99) || a.threshold.threshold - b.threshold.threshold);
  const tipping = s.early_warning.find((w) => w.status !== "stable");
  const index = Math.round(s.index.value);
  return lang === "ar" ? arabic(s, crossing, tipping, index) : english(s, crossing, tipping, index);
}

function english(s: Snapshot, crossing: Worker[], tipping: Snapshot["early_warning"][number] | undefined, index: number) {
  const place = s.site.name;
  if (crossing.length) {
    const w = crossing[0];
    const his = isHer(w) ? "her" : "his";
    const others = crossing.length - 1;
    const tail = others > 0 ? ` ${others} more of the crew follow${others === 1 ? "s" : ""}.` : "";
    if (w.eta_hours === 0)
      return {
        title: `${w.name} is past ${his} *line.*`,
        deck: `${place} reads ${index} on the Nabd Index. ${w.name}'s strain is ${w.psi.toFixed(1)} against a personal limit of ${w.threshold.threshold.toFixed(1)}.${tail}`,
      };
    return {
      title: `${w.name} crosses ${his} line at *${clockAfter(s.local_time, w.eta_hours!)}.*`,
      deck: `Nothing looks wrong yet. ${place} reads ${index}, and in ${w.eta_hours} h ${w.name}'s projected strain reaches ${w.projected_psi.toFixed(1)} — past ${his} own limit of ${w.threshold.threshold.toFixed(1)}, well before the generic 7.${tail}`,
    };
  }
  if (tipping)
    return {
      title: `The ${tipping.key} is losing its *rhythm.*`,
      deck: `${place} reads ${index}. ${tipping.explanation.charAt(0).toUpperCase() + tipping.explanation.slice(1)} No one is hurt — that is the point of reading it now.`,
    };
  if (index >= 50)
    return {
      title: `A hard day at ${place}, *held.*`,
      deck: `The Nabd Index is ${index}. Every worker's projected strain stays under their personal line for the next three hours.`,
    };
  return {
    title: `${place} is *steady.*`,
    deck: `The Nabd Index is ${index}. The land's signals recover normally from small shocks, and no one on the crew is near their line.`,
  };
}

function arabic(s: Snapshot, crossing: Worker[], tipping: Snapshot["early_warning"][number] | undefined, index: number) {
  const place = s.site.name_ar;
  if (crossing.length) {
    const w = crossing[0];
    const name = NAME_AR[w.name] ?? w.name;
    const her = isHer(w);
    const others = crossing.length - 1;
    const tail = others > 0 ? ` ويتبعه ${others} من الطاقم.` : "";
    if (w.eta_hours === 0)
      return {
        title: `${name} ${her ? "تجاوزت" : "تجاوز"} *${her ? "حدّها" : "حدّه"}.*`,
        deck: `يسجّل ${place} ${index} على مؤشر نبض. إجهاد ${name} ${w.psi.toFixed(1)} مقابل حدّ شخصي ${w.threshold.threshold.toFixed(1)}.${tail}`,
      };
    return {
      title: `${name} ${her ? "تتجاوز حدّها" : "يتجاوز حدّه"} الساعة *${clockAfter(s.local_time, w.eta_hours!)}.*`,
      deck: `لا شيء يبدو خاطئاً بعد. يسجّل ${place} ${index}، وبعد ${w.eta_hours} ساعات يصل الإجهاد المتوقع لـ${name} إلى ${w.projected_psi.toFixed(1)} — فوق ${her ? "حدّها" : "حدّه"} الخاص ${w.threshold.threshold.toFixed(1)}، وقبل الحد العام ٧ بكثير.${tail}`,
    };
  }
  if (tipping)
    return {
      title: `${SIGNAL_AR[tipping.key] ?? tipping.key} تفقد *إيقاعها.*`,
      deck: `يسجّل ${place} ${index}. الإشارة تتعافى من الصدمات الصغيرة ببطء متزايد. لم يُصب أحد — وهذا بالضبط سبب قراءتها الآن.`,
    };
  if (index >= 50)
    return {
      title: `يوم صعب في ${place}، *تحت السيطرة.*`,
      deck: `مؤشر نبض ${index}. الإجهاد المتوقع لكل عامل يبقى تحت حدّه الشخصي خلال الساعات الثلاث القادمة.`,
    };
  return {
    title: `${place} *مستقر.*`,
    deck: `مؤشر نبض ${index}. إشارات الأرض تتعافى طبيعياً من الصدمات الصغيرة، ولا أحد من الطاقم قريب من حدّه.`,
  };
}

/** Volume-and-number line for the masthead, like a printed bulletin. */
export function bulletinNo(iso: string) {
  const d = new Date(iso);
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
  return { vol: d.getFullYear() - 2023, no: day };
}
