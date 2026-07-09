// One-off import: Tasko admin API -> normalized sanitized fixture for the
// "Все позиции" audit page. Usage:
//   node --env-file=.env.local scripts/import-catalog-fixture.mjs
// Reads TASKO_LOGIN / TASKO_PASSWORD from env. Never prints or writes secrets.

import { writeFileSync } from "node:fs";

const BASE = "https://lk.tasko.group/be-fastapi";
const ORG_ID = "1a30780d-383c-4146-a55f-905c9c176833";
const OUT = "src/data/catalog.fixture.json";
const STATUSES = ["active", "stopped", "archive", "coming-soon"];

const LOGIN = process.env.TASKO_LOGIN;
const PWD = process.env.TASKO_PASSWORD;
if (!LOGIN || !PWD) {
  console.error("Missing TASKO_LOGIN / TASKO_PASSWORD in .env.local");
  process.exit(1);
}

async function call(path, { token, method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // Log status + path only; never response headers or request config.
    console.error(`HTTP ${res.status} on ${method} ${path.split("?")[0]}`);
    process.exit(1);
  }
  const json = await res.json();
  return json?.obj ?? json;
}

// obj.items comes back as a uuid-keyed map (sometimes an array).
const records = (c) =>
  Array.isArray(c?.items) ? c.items : c?.items ? Object.values(c.items) : [];

const langStr = (v, lang = "ru") => (v?.[lang] ?? "").trim();

// --- fetch ---------------------------------------------------------------

const isPhone = /^\d{6,}$/.test(LOGIN);
const auth = await call("/auth/api/landing/v1/login", {
  method: "POST",
  body: isPhone ? { phone: LOGIN, pwd: PWD } : { email: LOGIN, pwd: PWD },
});
const token = auth?.access_token;
if (!token) {
  console.error("Login succeeded but no access_token in response");
  process.exit(1);
}

const menus = records(await call(`/mvp/api/lk/v1/menu?orgId=${ORG_ID}`, { token }));
const menuId = menus[0]?.id;
if (!menuId) {
  console.error("No menu found for org");
  process.exit(1);
}
console.log(`menu: ${menus[0].name} (${menuId})`);

const statusQ = STATUSES.map((s) => `statusList=${s}`).join("&");
const tree = await call(`/mvp/api/lk/v1/menu/tree?menuId=${menuId}&${statusQ}`, { token });
const dishes = records(await call(`/mvp/api/lk/v1/menu/dish/all?menuId=${menuId}&${statusQ}`, { token }));
console.log(`dishes fetched: ${dishes.length}`);

// Per-dish recommendations: the API has no bulk endpoint (menu-level returns
// only menu-surface upsell), so one call per dish with a small worker pool.
const recCountByDish = new Map();
{
  const queue = [...dishes];
  const workers = Array.from({ length: 12 }, async () => {
    while (queue.length) {
      const d = queue.pop();
      const rec = await call(`/mvp/api/lk/v1/menu/recommendations/dish/${d.id}?menuId=${menuId}`, { token });
      recCountByDish.set(d.id, records(rec).filter((r) => r.isActive !== false).length);
    }
  });
  await Promise.all(workers);
  const withRec = [...recCountByDish.values()].filter((n) => n > 0).length;
  console.log(`recommendations fetched: ${withRec} of ${recCountByDish.size} dishes have some`);
}

// --- sections from tree ---------------------------------------------------

// Flatten every category node (any depth) into id -> section meta,
// keeping parentId so the UI can rebuild the hierarchy.
const sectionById = new Map();
let order = 0;
function walk(children, parentId = null) {
  const nodes = Array.isArray(children) ? children : Object.values(children ?? {});
  for (const node of nodes) {
    if (node?.type_ === "Dish") continue;
    if (node?.id) {
      sectionById.set(node.id, {
        id: node.id,
        parentId,
        name: langStr(node.name) || "Без названия",
        imageUrl: node.img?.sm ?? node.img?.md ?? node.img?.lg ?? null,
        sortOrder: order++,
      });
    }
    if (node?.children) walk(node.children, node.id);
  }
}
walk(tree?.children);
console.log(`categories in tree: ${sectionById.size}`);

// --- normalize dishes ------------------------------------------------------

const EXTRA_LANGS = ["kk", "en"]; // project languages beyond base ru
const anomalies = {
  emptyName: 0, noPhoto: 0, noPrice: 0, noDescription: 0, noWeight: 0,
  kbjuEmpty: 0, kbjuPartial: 0, translationMissing: 0, orphan: 0, unknownStatus: 0,
};

const items = dishes.map((d) => {
  const title = langStr(d.name) || langStr(d.name, "en");
  if (!title) anomalies.emptyName++;

  const section = sectionById.get(d.parentId);
  if (!section) anomalies.orphan++;

  let status = d.status ?? "active";
  if (!STATUSES.includes(status)) {
    anomalies.unknownStatus++;
    status = "active";
  }

  const thumbnailUrl = d.img?.sm ?? d.img?.md ?? d.img?.lg ?? null;
  if (!thumbnailUrl) anomalies.noPhoto++;

  const price = typeof d.price === "number" ? d.price : 0;
  if (!price) anomalies.noPrice++;

  const hasDescription = Boolean(langStr(d.description));
  if (!hasDescription) anomalies.noDescription++;

  const unitRu = langStr(d.unit);
  const weightLabel = d.capacity ? `${d.capacity} ${unitRu}`.trim() : null;
  if (!weightLabel) anomalies.noWeight++;

  const nutritionFilledCount = ["kcal", "fat", "protein", "carbs"]
    .filter((k) => d.nutrition?.[k] != null).length;
  if (nutritionFilledCount === 0) anomalies.kbjuEmpty++;
  else if (nutritionFilledCount < 4) anomalies.kbjuPartial++;

  // A language counts as translated when every applicable field is filled
  // (name always; description only if base ru has one).
  const fields = hasDescription ? ["name", "description"] : ["name"];
  const translationTotalCount = EXTRA_LANGS.length;
  const translationFilledCount = EXTRA_LANGS.filter((lang) =>
    fields.every((f) => langStr(d[f], lang)),
  ).length;
  if (translationFilledCount < translationTotalCount) anomalies.translationMissing++;

  const display = d.display ?? [];
  const displayMode = display.includes("hide-price")
    ? "no-price"
    : display.includes("hide-add")
      ? "no-button"
      : "full";

  return {
    id: d.id,
    title: title || "Без названия",
    description: langStr(d.description),
    sectionId: section?.id ?? "no-section",
    sectionName: section?.name ?? "Без раздела",
    thumbnailUrl,
    price,
    // priceWithSale echoes price when there is no sale — only keep it for real discounts
    priceWithSale: d.sale != null ? d.priceWithSale ?? null : null,
    status,
    scheduled: Boolean(d.schedule?.length),
    guestLabels: langStr(d.badge) ? [langStr(d.badge)] : [],
    tags: (d.tags ?? []).map((t) => langStr(t)).filter(Boolean),
    optionsCount: d.settings?.length ?? 0,
    modifiersCount: d.modifiers?.length ?? 0,
    recommendationsCount: recCountByDish.get(d.id) ?? 0,
    displayMode,
    hasDescription,
    weightLabel,
    nutritionFilledCount,
    translationFilledCount,
    translationTotalCount,
    hasDiscount: d.sale != null,
  };
});

// ponytail: synthetic demo items — this menu has no discounts, partial КБЖУ
// or coming-soon positions, so the audit UI states would be untestable.
const donor = items.find((i) => i.thumbnailUrl);
const synth = (id, over) => ({
  ...donor,
  description: "Демо-описание позиции для проверки редактора.",
  guestLabels: [],
  tags: [],
  optionsCount: 0,
  modifiersCount: 0,
  recommendationsCount: 0,
  displayMode: "full",
  scheduled: false,
  status: "active",
  hasDescription: true,
  weightLabel: "250 г",
  nutritionFilledCount: 0,
  translationFilledCount: 2,
  translationTotalCount: 2,
  priceWithSale: null,
  hasDiscount: false,
  ...over,
  id: `synthetic-${id}`,
});
items.push(
  synth("sale-1", { title: "Демо: сырники со скидкой", price: 2400, priceWithSale: 1900, hasDiscount: true }),
  synth("sale-2", { title: "Демо: латте со скидкой", price: 1800, priceWithSale: 1400, hasDiscount: true, thumbnailUrl: null }),
  synth("kbju-2of4", { title: "Демо: КБЖУ 2 из 4", price: 3100, nutritionFilledCount: 2 }),
  synth("kbju-3of4", { title: "Демо: КБЖУ 3 из 4", price: 2700, nutritionFilledCount: 3 }),
  synth("soon", { title: "Демо: скоро в меню", price: 4500, status: "coming-soon" }),
  synth("no-button", { title: "Демо: без кнопки заказа", price: 2900, displayMode: "no-button" }),
  synth("no-price", { title: "Демо: без кнопки и цены", price: 3300, displayMode: "no-price" }),
);

// All sections (with hierarchy), in tree order; synthetic "no-section" last if needed.
const usedIds = new Set(items.map((i) => i.sectionId));
const sections = [...sectionById.values()].sort((a, b) => a.sortOrder - b.sortOrder);
if (usedIds.has("no-section")) {
  sections.push({ id: "no-section", parentId: null, name: "Без раздела", imageUrl: null, sortOrder: order });
}

// Items in section order, then by dish sortOrder within section.
const sectionRank = new Map(sections.map((s, i) => [s.id, i]));
const dishOrder = new Map(dishes.map((d) => [d.id, d.sortOrder ?? 0]));
items.sort(
  (a, b) =>
    (sectionRank.get(a.sectionId) ?? 999) - (sectionRank.get(b.sectionId) ?? 999) ||
    (dishOrder.get(a.id) ?? 0) - (dishOrder.get(b.id) ?? 0),
);

// --- write -----------------------------------------------------------------

const fixture = { generatedAt: new Date().toISOString(), menuName: menus[0].name, sections, items };
const out = JSON.stringify(fixture, null, 2);
if (out.includes(token) || out.includes(PWD)) {
  console.error("SAFETY: secret found in fixture output, aborting");
  process.exit(1);
}
writeFileSync(OUT, out + "\n");

const byStatus = {};
for (const i of items) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
console.log(`\nwritten: ${OUT}`);
console.log(`items: ${items.length}, sections: ${sections.length}`);
console.log("by status:", byStatus);
console.log("scheduled:", items.filter((i) => i.scheduled).length, "| discount:", items.filter((i) => i.hasDiscount).length);
const byDisplay = {};
for (const i of items) byDisplay[i.displayMode] = (byDisplay[i.displayMode] ?? 0) + 1;
console.log("display modes:", byDisplay, "| with recommendations:", items.filter((i) => i.recommendationsCount > 0).length);
console.log("anomalies:", anomalies);
