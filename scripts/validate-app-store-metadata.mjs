import fs from "node:fs";

const file = new URL("../docs/app-store/metadata.zh-Hans.json", import.meta.url);
const metadata = JSON.parse(fs.readFileSync(file, "utf8"));
const localization = metadata.localizations["zh-Hans"];
const limits = {
  name: 30,
  subtitle: 30,
  description: 4000,
  keywords: 100,
  promotionalText: 170,
  supportUrl: 255,
  marketingUrl: 255,
  privacyPolicyUrl: 255,
};

for (const [field, limit] of Object.entries(limits)) {
  const value = field === "name" ? metadata.app.name : localization[field];
  if (typeof value !== "string" || value.length > limit || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string of at most ${limit} characters`);
  }
}

if (localization.whatsNew !== undefined && (typeof localization.whatsNew !== "string" || localization.whatsNew.length > 4000)) {
  throw new Error("whatsNew must be a string of at most 4000 characters when present");
}

if (localization.keywords.split(",").some((keyword) => keyword.trim().length === 0)) {
  throw new Error("keywords contains an empty term");
}

for (const field of ["supportUrl", "marketingUrl", "privacyPolicyUrl"]) {
  const url = new URL(localization[field]);
  if (url.protocol !== "https:") throw new Error(`${field} must use HTTPS`);
}

for (const screenshot of metadata.screenshots ?? []) {
  if (!screenshot.file || !screenshot.caption) throw new Error("Each screenshot needs a file and caption");
  const screenshotPath = new URL(`../${screenshot.file}`, import.meta.url);
  if (!fs.existsSync(screenshotPath)) throw new Error(`Screenshot does not exist: ${screenshot.file}`);
  const header = fs.readFileSync(screenshotPath).subarray(0, 24);
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  if (header.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || width !== 1320 || height !== 2868) {
    throw new Error(`Screenshot must be 1320x2868: ${screenshot.file}`);
  }
}

const review = metadata.review;
for (const field of ["contactFirstName", "contactLastName", "contactEmail", "notes"]) {
  if (!review[field] || typeof review[field] !== "string") throw new Error(`review.${field} is required`);
}

console.log("App Store metadata is valid.");
console.log(JSON.stringify({
  locale: "zh-Hans",
  lengths: Object.fromEntries(Object.keys(limits).map((field) => [field, (field === "name" ? metadata.app.name : localization[field]).length])),
}, null, 2));
