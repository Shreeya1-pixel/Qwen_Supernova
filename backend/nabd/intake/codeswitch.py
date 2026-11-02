"""Code-switched symptom intake.

Workers write the way they speak: "bhai sar ghoom raha hai, paani khatam",
"mafi mai w rasi y3awerni", "nahihilo ako, walang tubig". This module
normalises the text (Arabizi digits, Arabic diacritics, spacing), matches a
multilingual symptom lexicon, and replies in the language the worker used.

Lexicon approach is deliberate: deterministic, explainable, works offline on
a phone, and extends by adding phrases — no model to retrain.
"""
from __future__ import annotations

import re
import unicodedata

ARABIZI = str.maketrans({"2": "ء", "3": "ع", "5": "خ", "6": "ط", "7": "ح", "8": "ق", "9": "ص"})
ARABIC_DIACRITICS = re.compile(r"[\u064B-\u0652\u0640]")

# symptom -> {language: [phrases]}  (romanised and native scripts)
LEXICON: dict[str, dict[str, list[str]]] = {
    "dizziness": {
        "en": ["dizzy", "dizziness", "head spinning", "lightheaded"],
        "hi": ["sar ghoom", "sir ghoom", "chakkar", "चक्कर", "सिर घूम"],
        "ur": ["chakar", "sar chakra", "چکر"],
        "ar": ["دوخة", "دايخ", "داخ", "dookha", "dawkha", "dayekh"],
        "ml": ["thala karangunnu", "thalakaraKKam", "തല കറങ്ങുന്നു"],
        "ta": ["thalai suthudhu", "thala suthuthu", "தலை சுற்று"],
        "tl": ["nahihilo", "hilo"],
        "bn": ["matha ghurche", "মাথা ঘুরছে"],
    },
    "headache": {
        "en": ["headache", "head hurts", "head pain"],
        "hi": ["sar dard", "sir dard", "सिर दर्द"],
        "ur": ["sar dard", "سر درد"],
        "ar": ["صداع", "راسي يوجعني", "suda3", "rasi y3awerni"],
        "ml": ["thala vedana", "തലവേദന"],
        "ta": ["thalai vali", "தலைவலி"],
        "tl": ["masakit ang ulo", "sakit ng ulo"],
        "bn": ["matha byatha", "মাথা ব্যথা"],
    },
    "nausea": {
        "en": ["nausea", "vomit", "throwing up", "feel sick"],
        "hi": ["ulti", "जी मचल", "उल्टी", "ji machal"],
        "ur": ["ulti", "متلی", "qay"],
        "ar": ["غثيان", "استفراغ", "ghathayan", "estefragh"],
        "ml": ["chardi", "ഛർദ്ദി", "oakkanam"],
        "ta": ["vaanthi", "வாந்தி"],
        "tl": ["nasusuka", "suka"],
        "bn": ["bomi", "বমি"],
    },
    "no_water": {
        "en": ["no water", "water finished", "out of water", "thirsty"],
        "hi": ["paani khatam", "pani khatam", "paani nahi", "pyaas", "पानी खत्म", "प्यास"],
        "ur": ["pani khatam", "پانی ختم", "pyas"],
        "ar": ["ما في ماي", "مافي ماي", "mafi mai", "ma fi mai", "عطشان", "3atshan"],
        "ml": ["vellam illa", "വെള്ളം ഇല്ല", "daaham"],
        "ta": ["thanni illa", "தண்ணீர் இல்லை"],
        "tl": ["walang tubig", "uhaw"],
        "bn": ["pani nai", "পানি নেই"],
    },
    "cramps": {
        "en": ["cramp", "cramps", "muscle pain"],
        "hi": ["akdan", "ainthan", "ऐंठन"],
        "ar": ["تشنج", "شد عضلي", "tashannoj"],
        "tl": ["pulikat"],
        "ml": ["kochi pidutham"],
    },
    "chest_pain": {
        "en": ["chest pain", "chest hurts", "chest tight"],
        "hi": ["seene me dard", "chhati me dard", "सीने में दर्द"],
        "ur": ["seene mein dard", "سینے میں درد"],
        "ar": ["ألم في الصدر", "صدري يوجعني", "sadri"],
        "ml": ["nenju vedana", "നെഞ്ചുവേദന"],
        "ta": ["nenju vali", "நெஞ்சு வலி"],
        "tl": ["masakit ang dibdib"],
    },
    "breathless": {
        "en": ["can't breathe", "cant breathe", "short of breath", "breathless"],
        "hi": ["saans nahi", "saans phool", "सांस"],
        "ur": ["saans", "سانس"],
        "ar": ["ضيق تنفس", "ما اقدر اتنفس", "mo a8dar atnafas"],
        "ml": ["shwasam muttal", "ശ്വാസം"],
        "tl": ["hirap huminga"],
    },
    "confusion": {
        "en": ["confused", "can't think", "don't know where"],
        "hi": ["samajh nahi aa raha", "dimag kaam nahi"],
        "ar": ["مشوش", "مو فاهم شي"],
        "tl": ["nalilito"],
    },
    "fainting": {
        "en": ["fainted", "passed out", "collapsed", "fainting"],
        "hi": ["behosh", "gir gaya", "बेहोश"],
        "ur": ["behosh", "بے ہوش"],
        "ar": ["اغمى", "إغماء", "taah", "طاح"],
        "ml": ["bodham poyi"],
        "tl": ["nahimatay"],
    },
    "no_sweat": {
        "en": ["not sweating", "stopped sweating", "skin dry and hot"],
        "hi": ["paseena nahi", "पसीना नहीं"],
        "ar": ["ما اعرق", "ما في عرق"],
    },
}

SEVERITY = {"fainting": 3, "confusion": 3, "no_sweat": 3, "chest_pain": 3, "breathless": 2,
            "dizziness": 2, "nausea": 2, "no_water": 1, "headache": 1, "cramps": 1}

REPLIES = {
    "en": "Stop work now. Move to shade, drink 500 ml water slowly. Your supervisor has been told.",
    "hi": "अभी काम रोकिए। छाँव में जाइए, धीरे-धीरे 500 ml पानी पीजिए। सुपरवाइज़र को बता दिया गया है।",
    "ur": "ابھی کام روک دیں۔ سائے میں جائیں، آہستہ آہستہ 500 ملی لیٹر پانی پئیں۔ سپروائزر کو اطلاع دے دی گئی ہے۔",
    "ar": "أوقف العمل الآن. انتقل إلى الظل واشرب ٥٠٠ مل ماء ببطء. تم إبلاغ المشرف.",
    "ml": "ഇപ്പോൾ ജോലി നിർത്തുക. തണലിലേക്ക് മാറി, പതുക്കെ 500 ml വെള്ളം കുടിക്കുക. സൂപ്പർവൈസറെ അറിയിച്ചിട്ടുണ്ട്.",
    "ta": "இப்போதே வேலையை நிறுத்துங்கள். நிழலுக்குச் சென்று 500 ml தண்ணீர் மெதுவாகக் குடியுங்கள். மேற்பார்வையாளருக்குத் தெரிவிக்கப்பட்டது.",
    "tl": "Itigil ang trabaho ngayon. Pumunta sa lilim at uminom ng 500 ml na tubig nang dahan-dahan. Naabisuhan na ang supervisor.",
    "bn": "এখনই কাজ থামান। ছায়ায় যান, ধীরে ধীরে ৫০০ ml পানি পান করুন। সুপারভাইজারকে জানানো হয়েছে।",
}
EMERGENCY_SUFFIX = {
    "en": " Emergency: call 998 / 999.",
    "hi": " आपातकाल: 998 / 999 पर कॉल करें।",
    "ur": " ایمرجنسی: 998 / 999 پر کال کریں۔",
    "ar": " حالة طارئة: اتصل على ٩٩٨ / ٩٩٩.",
    "ml": " അടിയന്തരം: 998 / 999 വിളിക്കുക.",
    "ta": " அவசரம்: 998 / 999 அழைக்கவும்.",
    "tl": " Emergency: tumawag sa 998 / 999.",
    "bn": " জরুরি: 998 / 999 নম্বরে কল করুন।",
}
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "ur": "Urdu", "ar": "Arabic / Arabizi", "ml": "Malayalam",
                  "ta": "Tamil", "tl": "Tagalog", "bn": "Bengali"}


def normalise(text: str) -> tuple[str, str]:
    """Return (latin-lowered form, arabizi-converted form)."""
    t = unicodedata.normalize("NFKC", text).lower()
    t = ARABIC_DIACRITICS.sub("", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t, t.translate(ARABIZI)


def parse(text: str, fallback_language: str = "en") -> dict:
    plain, arabized = normalise(text)
    found: dict[str, list[dict]] = {}
    language_votes: dict[str, int] = {}
    for symptom, by_lang in LEXICON.items():
        for lang, phrases in by_lang.items():
            for phrase in phrases:
                p = phrase.lower()
                if p in plain or p in arabized:
                    found.setdefault(symptom, []).append({"phrase": phrase, "language": lang})
                    language_votes[lang] = language_votes.get(lang, 0) + len(p)
                    break

    if re.search(r"[\u0600-\u06FF]", text) and "ur" not in language_votes:
        language_votes["ar"] = language_votes.get("ar", 0) + 1
    languages = sorted(language_votes, key=language_votes.get, reverse=True)
    # English is the borrowed layer in code-switched text; reply in the worker's own language.
    native = [lang for lang in languages if lang != "en"]
    language = native[0] if native else (languages[0] if languages else fallback_language)

    symptoms = sorted(found, key=lambda s: SEVERITY.get(s, 0), reverse=True)
    severity = max((SEVERITY.get(s, 1) for s in symptoms), default=0)
    level = ["none", "low", "high", "emergency"][severity]
    reply = ""
    if symptoms:
        reply = REPLIES.get(language, REPLIES["en"])
        if severity >= 3:
            reply += EMERGENCY_SUFFIX.get(language, EMERGENCY_SUFFIX["en"])

    return {
        "text": text,
        "symptoms": symptoms,
        "matches": found,
        "severity": level,
        "language": language,
        "language_name": LANGUAGE_NAMES.get(language, language),
        "code_switched": len(languages) > 1,
        "languages": languages,
        "reply": reply,
    }
