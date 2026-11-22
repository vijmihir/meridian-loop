// Words for the screens manufacturers use: the listing form, the quote reply and the inbox.
// English, Hindi, Vietnamese and Bengali; the choice is kept in this browser.
export const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['vi', 'Tiếng Việt'], ['bn', 'বাংলা']];

const W = {
  yourCompany: { en: 'Your company', hi: 'आपकी कंपनी', vi: 'Công ty của bạn', bn: 'আপনার কোম্পানি' },
  companyName: { en: 'Company name', hi: 'कंपनी का नाम', vi: 'Tên công ty', bn: 'কোম্পানির নাম' },
  contactName: { en: 'Contact name', hi: 'संपर्क व्यक्ति', vi: 'Người liên hệ', bn: 'যোগাযোগের নাম' },
  email: { en: 'Email', hi: 'ईमेल', vi: 'Email', bn: 'ইমেল' },
  country: { en: 'Country', hi: 'देश', vi: 'Quốc gia', bn: 'দেশ' },
  city: { en: 'City', hi: 'शहर', vi: 'Thành phố', bn: 'শহর' },
  about: { en: 'About you', hi: 'आपके बारे में', vi: 'Giới thiệu', bn: 'আপনার সম্পর্কে' },
  whatYouMake: { en: 'What you make', hi: 'आप क्या बनाते हैं', vi: 'Bạn sản xuất gì', bn: 'আপনি কী তৈরি করেন' },
  products: { en: 'Products', hi: 'उत्पाद', vi: 'Sản phẩm', bn: 'পণ্য' },
  materials: { en: 'Materials', hi: 'सामग्री', vi: 'Chất liệu', bn: 'উপকরণ' },
  processes: { en: 'Processes', hi: 'प्रक्रियाएँ', vi: 'Quy trình', bn: 'প্রক্রিয়া' },
  certifications: { en: 'Certifications', hi: 'प्रमाणपत्र', vi: 'Chứng nhận', bn: 'সার্টিফিকেশন' },
  moq: { en: 'Minimum order (units)', hi: 'न्यूनतम ऑर्डर (पीस)', vi: 'Đơn tối thiểu (chiếc)', bn: 'সর্বনিম্ন অর্ডার (পিস)' },
  lead: { en: 'Lead time (days)', hi: 'डिलीवरी समय (दिन)', vi: 'Thời gian sản xuất (ngày)', bn: 'সময় লাগে (দিন)' },
  commas: { en: 'Separate with commas.', hi: 'अल्पविराम से अलग करें।', vi: 'Cách nhau bằng dấu phẩy.', bn: 'কমা দিয়ে আলাদা করুন।' },
  listMe: { en: 'List my company', hi: 'मेरी कंपनी जोड़ें', vi: 'Đăng công ty của tôi', bn: 'আমার কোম্পানি যোগ করুন' },
  price: { en: 'Price a piece (US$)', hi: 'प्रति पीस कीमत (US$)', vi: 'Giá mỗi chiếc (US$)', bn: 'প্রতি পিস দাম (US$)' },
  sampleCost: { en: 'Sample cost (US$)', hi: 'सैंपल की कीमत (US$)', vi: 'Giá mẫu (US$)', bn: 'নমুনার দাম (US$)' },
  sampleDays: { en: 'Sample time (days)', hi: 'सैंपल का समय (दिन)', vi: 'Thời gian làm mẫu (ngày)', bn: 'নমুনার সময় (দিন)' },
  terms: { en: 'Shipping terms', hi: 'शिपिंग शर्तें', vi: 'Điều kiện giao hàng', bn: 'শিপিং শর্ত' },
  note: { en: 'Note to the brand', hi: 'ब्रांड के लिए संदेश', vi: 'Ghi chú cho thương hiệu', bn: 'ব্র্যান্ডের জন্য নোট' },
  sendQuote: { en: 'Send quote', hi: 'कोटेशन भेजें', vi: 'Gửi báo giá', bn: 'কোটেশন পাঠান' },
  decline: { en: 'Decline request', hi: 'अनुरोध मना करें', vi: 'Từ chối yêu cầu', bn: 'অনুরোধ ফিরিয়ে দিন' },
  yourQuote: { en: 'Your quote', hi: 'आपका कोटेशन', vi: 'Báo giá của bạn', bn: 'আপনার কোটেশন' },
  language: { en: 'Language', hi: 'भाषा', vi: 'Ngôn ngữ', bn: 'ভাষা' },
};

export function getLang() { try { return localStorage.getItem('ml-lang') || 'en'; } catch { return 'en'; } }
export function setLang(l) { try { localStorage.setItem('ml-lang', l); } catch { /* private mode */ } }
export const t = (key, lang = getLang()) => W[key]?.[lang] || W[key]?.en || key;
