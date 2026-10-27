/**
 * Sinhala for dashboard texts that have a number or a name inside them ("Delete 3 products?", Product "Table" saved.). The name or number is carried
 * over unchanged. Each pattern is tried only when the exact text is not in the dictionary.
 */
type Make = (m: RegExpExecArray) => string | null;

const NOUN: Record<string, string> = {
  product: "නිෂ්පාදිතය",
  products: "නිෂ්පාදන",
  customer: "ගනුදෙනුකරු",
  customers: "ගනුදෙනුකරුවන්",
  order: "ඇණවුම",
  orders: "ඇණවුම්",
  enquiry: "විමසීම",
  enquiries: "විමසීම්",
  "enquiry or quotation": "විමසීමක් හෝ මිල ගණනක්",
  "enquiries and quotations": "විමසීම් සහ මිල ගණන්",
  quotation: "මිල ගණන",
  quotations: "මිල ගණන්",
  message: "පණිවිඩය",
  messages: "පණිවිඩ",
  request: "ඉල්ලීම",
  requests: "ඉල්ලීම්",
  review: "සමාලෝචනය",
  reviews: "සමාලෝචන",
  photo: "ඡායාරූපය",
  photos: "ඡායාරූප",
  category: "ප්‍රවර්ගය",
  categories: "ප්‍රවර්ග",
  subcategory: "උප ප්‍රවර්ගය",
  subcategories: "උප ප්‍රවර්ග",
  "main category": "ප්‍රධාන ප්‍රවර්ගය",
  "main categories": "ප්‍රධාන ප්‍රවර්ග",
  account: "ගිණුම",
  accounts: "ගිණුම්",
};
const noun = (w: string) => NOUN[w.toLowerCase()] ?? w;

const VERB: Record<string, string> = { Delete: "මකන්න", Archive: "සංරක්ෂණය කරන්න", Restore: "ප්‍රතිසාධනය කරන්න", Publish: "ප්‍රකාශයට පත් කරන්න", Unpublish: "ප්‍රකාශනය ඉවත් කරන්න", Hide: "සඟවන්න", Show: "පෙන්වන්න" };
const TAB: Record<string, string> = { "All customers": "සියලු ගනුදෙනුකරුවන්", "All enquiries": "සියලු විමසීම්", "All requests": "සියලු ඉල්ලීම්", New: "අලුත්", Responded: "පිළිතුරු දුන්" };
const LABEL: Record<string, string> = { Price: "මිල", "Delivery charge": "බෙදාහැරීමේ ගාස්තුව", "Amount off": "අඩු කරන මුදල", Total: "එකතුව" };
const STATUS: Record<string, string> = { new: "අලුත්", confirmed: "තහවුරු කළ", "in progress": "නිෂ්පාදනයේ පවතී", ready: "සූදානම්", "out for delivery": "බෙදාහැරීමට පිටත්ව ඇත", delivered: "අවසන්", refunded: "මුදල් ආපසු දුන්", cancelled: "අවලංගු කළ" };
const PRODUCT_DONE: Record<string, string> = {
  "archived and hidden from the website": "සංරක්ෂණය කර වෙබ් අඩවියෙන් සඟවන ලදී",
  "published on the website": "වෙබ් අඩවියේ ප්‍රකාශයට පත් කරන ලදී",
  "taken off the website (kept as drafts)": "වෙබ් අඩවියෙන් ඉවත් කරන ලදී (කෙටුම්පත් ලෙස තබා ඇත)",
  "restored (still unpublished until you publish)": "ප්‍රතිසාධනය කරන ලදී (ඔබ ප්‍රකාශයට පත් කරන තුරු තවමත් ප්‍රකාශිත නොවේ)",
};

import { SI } from "./si";

export const SI_PATTERNS: Array<[RegExp, Make]> = [
  [/^Open (.+)$/, (m) => `${SI[m[1]!] ?? m[1]} විවෘත කරන්න`],
  [/^(The answer|The best answers) for “(.+)”$/, (m) => `“${m[2]}” සඳහා ${m[1] === "The answer" ? "පිළිතුර" : "හොඳම පිළිතුරු"}`],
  [/^No answer found for “(.+)”$/, (m) => `“${m[1]}” සඳහා පිළිතුරක් හමු නොවීය`],
  [/^Page (\d+) of (\d+)$/, (m) => `පිටුව ${m[1]} / ${m[2]}`],
  [/^(Delete|Archive|Restore|Publish|Unpublish|Hide|Show) \((\d+)\)$/, (m) => `${VERB[m[1]!]} (${m[2]})`],
  [/^Delete (\d+) (.+)\?$/, (m) => `${noun(m[2]!)} ${m[1]} ක් මකන්නද?`],
  [/^(All customers|All enquiries|All requests|New|Responded) \((\d+)\)$/, (m) => `${TAB[m[1]!]} (${m[2]})`],
  [/^(Price|Delivery charge|Amount off|Total) \((.+)\)$/, (m) => `${LABEL[m[1]!]} (${m[2]})`],
  [/^Photo (\d+)$/, (m) => `ඡායාරූපය ${m[1]}`],
  [/^Photo (\d+) of (\d+)$/, (m) => `ඡායාරූපය ${m[1]} / ${m[2]}`],
  [/^Delete photo (\d+)$/, (m) => `${m[1]} වන ඡායාරූපය මකන්න`],
  [/^Edit photo (\d+): choose which part shows$/, (m) => `${m[1]} වන ඡායාරූපය සංස්කරණය කරන්න: පෙනෙන කොටස තෝරන්න`],
  [/^Placed (.+)$/, (m) => `ඇණවුම් කළේ ${m[1]}`],
  [/^Product "(.+)" saved\.$/, (m) => `නිෂ්පාදිතය "${m[1]}" සුරකින ලදී.`],
  [/^Main category "(.+)" added\.$/, (m) => `ප්‍රධාන ප්‍රවර්ගය "${m[1]}" එක් කරන ලදී.`],
  [/^Main category "(.+)" added with (\d+) subcategor(?:y|ies)\.$/, (m) => `ප්‍රධාන ප්‍රවර්ගය "${m[1]}" උප ප්‍රවර්ග ${m[2]} ක් සමඟ එක් කරන ලදී.`],
  [/^(\d+) products? (archived and hidden from the website|published on the website|taken off the website \(kept as drafts\)|restored \(still unpublished until you publish\))\.$/, (m) => `නිෂ්පාදන ${m[1]} ${PRODUCT_DONE[m[2]!]}.`],
  [/^(\d+) photos? added\.$/, (m) => `ඡායාරූප ${m[1]} ක් එක් කරන ලදී.`],
  [/^(Enquiry|Quotation|Message|Request) marked as responded\.$/, (m) => `${noun(m[1]!)} පිළිතුරු දුන්නා ලෙස සලකුණු කරන ලදී.`],
  [/^(Enquiry|Quotation|Message|Request) moved back to new\.$/, (m) => `${noun(m[1]!)} නැවත අලුත් බවට ගෙන යන ලදී.`],
  [/^Order status changed to (.+)\.$/, (m) => `ඇණවුමේ තත්ත්වය "${STATUS[m[1]!.toLowerCase()] ?? m[1]}" ලෙස වෙනස් කරන ලදී.`],
  [/^(?:Edit|Change) status for order (.+)$/, (m) => `${m[1]} ඇණවුමේ තත්ත්වය වෙනස් කරන්න`],
  [/^(?:Edit|Change) payment status for order (.+)$/, (m) => `${m[1]} ඇණවුමේ ගෙවීම් තත්ත්වය වෙනස් කරන්න`],
  [/^Orders per day over the last 30 days: (\d+) in total\.$/, (m) => `පසුගිය දින 30 තුළ දිනකට ඇණවුම්: මුළු ${m[1]} ක්.`],
  [/^(\d+) orders? · (.+) paid$/, (m) => `ඇණවුම් ${m[1]} · ${m[2]} ගෙවා ඇත`],
  [/^(.+)\. What needs doing today\.$/, (m) => `${m[1]}. අද කළ යුතු දේ.`],
  [/^A product can have up to (\d+) photos\.$/, (m) => `නිෂ්පාදිතයකට ඡායාරූප ${m[1]} ක් දක්වා තිබිය හැක.`],
  [/^(.+) is over 8 MB\.$/, (m) => `${m[1]} 8 MB ඉක්මවයි.`],
  [/^Display order saved for (\d+) main categor(?:y|ies)\.$/, (m) => `ප්‍රධාන ප්‍රවර්ග ${m[1]} සඳහා ප්‍රදර්ශන අනුපිළිවෙල සුරකින ලදී.`],
  [/^Remove (.+)$/, (m) => `${m[1]} ඉවත් කරන්න`],
  [/^Select (.+)$/, (m) => `${m[1]} තෝරන්න`],
];
