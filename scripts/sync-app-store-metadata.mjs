import crypto from "node:crypto";
import fs from "node:fs";

const metadataFile = new URL("../docs/app-store/metadata.zh-Hans.json", import.meta.url);
const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
const locale = "zh-Hans";
const write = process.argv.includes("--write");
const apiBaseUrl = "https://api.appstoreconnect.apple.com/v1";

if (process.argv.some((argument) => argument !== "--write" && argument !== process.argv[0] && argument !== process.argv[1])) {
  throw new Error("Usage: node scripts/sync-app-store-metadata.mjs [--write]");
}

const { ASC_KEY_ID: keyId, ASC_ISSUER_ID: issuerId, ASC_KEY_P8: privateKey } = process.env;
if (!keyId || !issuerId || !privateKey) {
  throw new Error("ASC_KEY_ID, ASC_ISSUER_ID, and ASC_KEY_P8 must be set (for example through Doppler).");
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url({ alg: "ES256", kid: keyId, typ: "JWT" });
  const payload = base64Url({
    iss: issuerId,
    iat: now,
    exp: now + 600,
    aud: "appstoreconnect-v1",
  });
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return `${signingInput}.${signature}`;
}

async function request(path, options = {}) {
  if (!/^\/[A-Za-z0-9./?&=_,\-\[\]]+$/.test(path)) throw new Error("Invalid App Store Connect API path.");
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${createToken()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`App Store Connect API request failed with HTTP ${response.status}.`);
  }
  return body;
}

async function collection(path, label) {
  const response = await request(path);
  if (response.data.length !== 1) throw new Error(`Expected exactly one ${label}; found ${response.data.length}.`);
  return response.data[0];
}

async function applyResource(resource, attributes) {
  const changed = Object.entries(attributes).filter(([key, value]) => resource.attributes[key] !== value);
  if (changed.length === 0) {
    console.log("No resource metadata change.");
    return;
  }

  if (!write) {
    console.log("Would update resource metadata.");
    return;
  }

  await request(`/${resource.type}/${resource.id}`, {
    method: "PATCH",
    body: JSON.stringify({ data: { type: resource.type, id: resource.id, attributes } }),
  });
  console.log("Updated resource metadata.");
}

async function applyRelationship(resource, relationship, categoryId) {
  const current = resource.relationships?.[relationship]?.data?.id;
  if (current === categoryId) {
    console.log("No category change.");
    return;
  }
  if (!write) {
    console.log("Would update app category.");
    return;
  }
  await request(`/appInfos/${resource.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: resource.type,
        id: resource.id,
        relationships: { [relationship]: { data: { type: "appCategories", id: categoryId } } },
      },
    }),
  });
  console.log("Updated app category.");
}

async function applyReviewDetail(resource, attributes, appStoreVersionId) {
  if (resource) {
    await applyResource(resource, attributes);
    return;
  }
  if (!write) {
    console.log("Would create appStoreReviewDetails for version 1.0");
    return;
  }
  await request("/appStoreReviewDetails", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "appStoreReviewDetails",
        attributes,
        relationships: {
          appStoreVersion: { data: { type: "appStoreVersions", id: appStoreVersionId } },
        },
      },
    }),
  });
  console.log("Created appStoreReviewDetails for version 1.0");
}

if (write && !metadata.review.contactPhone) {
  throw new Error("review.contactPhone must be a real contact number before --write can update App Store review details.");
}

const app = await collection(`/apps?filter[bundleId]=com.possibility.possibility`, "app with bundle id com.possibility.possibility");
const appInfo = await collection(`/apps/${app.id}/appInfos?include=primaryCategory,secondaryCategory`, "app info");
const appInfoLocalization = await collection(`/appInfos/${appInfo.id}/appInfoLocalizations?filter[locale]=${locale}`, `${locale} app info localization`);
const versions = await request(`/apps/${app.id}/appStoreVersions`);
const versionCandidates = versions.data.filter((resource) => resource.attributes.platform === "IOS" && resource.attributes.versionString === "1.0");
if (versionCandidates.length !== 1) throw new Error(`Expected exactly one iOS version 1.0; found ${versionCandidates.length}.`);
const version = versionCandidates[0];
const versionLocalization = await collection(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?filter[locale]=${locale}`, `${locale} version localization`);
const ageRating = (await request(`/appInfos/${appInfo.id}/ageRatingDeclaration`)).data;
const review = (await request(`/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;

const localized = metadata.localizations[locale];
await applyResource(appInfoLocalization, {
  name: metadata.app.name,
  subtitle: localized.subtitle,
  privacyPolicyUrl: localized.privacyPolicyUrl,
});
await applyResource(versionLocalization, {
  description: localized.description,
  keywords: localized.keywords,
  marketingUrl: localized.marketingUrl,
  promotionalText: localized.promotionalText,
  supportUrl: localized.supportUrl,
  ...(localized.whatsNew === undefined ? {} : { whatsNew: localized.whatsNew }),
});
await applyResource(version, { copyright: localized.copyright });
await applyResource(ageRating, metadata.app.ageRating);
await applyRelationship(appInfo, "primaryCategory", metadata.app.primaryCategory);
await applyRelationship(appInfo, "secondaryCategory", metadata.app.secondaryCategory);
await applyReviewDetail(review, {
  contactFirstName: metadata.review.contactFirstName,
  contactLastName: metadata.review.contactLastName,
  contactEmail: metadata.review.contactEmail,
  contactPhone: metadata.review.contactPhone,
  demoAccountRequired: metadata.review.demoAccountRequired,
  notes: metadata.review.notes,
}, version.id);

console.log(write ? "App Store Connect metadata update completed." : "Dry run completed. Re-run with --write after confirming the public support mailbox and review phone number.");
