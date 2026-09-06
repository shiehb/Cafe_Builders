import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { toDecimal } from "../src/services/serialization";
import { PRODUCTS } from "../src/data/menuData";

// =============================================================================
// DEV / MOCK CATALOG SEED
// -----------------------------------------------------------------------------
// This seed populates a TEMPORARY, NON-AUTHORITATIVE catalog used solely to
// exercise the Step 6 domain model (ingredients, product-ingredient joins,
// customization groups with systemKey SUGAR/ICE, per-product customization
// options with surcharges). See catalog_source_discovery_step7.md: the
// authoritative catalog source is NOT_FOUND. This data is deterministic and
// idempotent (safe to run any number of times) for R3/R4/R5 development only.
//
// Scope: NO promotions, NO orders. Orders must remain 0 after seeding.
// =============================================================================

let dbUrl = process.env.DATABASE_URL || "";
if (dbUrl.includes(":6543") && !dbUrl.includes("pgbouncer=true")) {
  dbUrl += dbUrl.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

interface IngredientDef {
  id: string;
  name: string;
  isAvailable?: boolean;
}

const INGREDIENTS: IngredientDef[] = [
  { id: "ing_espresso", name: "Espresso Shot" },
  { id: "ing_matcha", name: "Ceremonial Matcha Powder" },
  { id: "ing_black_tea", name: "Ceylon Black Tea" },
  { id: "ing_hojicha", name: "Hojicha Powder" },
  { id: "ing_cold_brew", name: "Cold Brew Concentrate" },
  { id: "ing_filter_beans", name: "Single Origin Filter Beans" },
  { id: "ing_whole_milk", name: "Whole Fresh Milk" },
  { id: "ing_oat_milk", name: "Oat Milk" },
  { id: "ing_almond_milk", name: "Almond Milk" },
  { id: "ing_soy_milk", name: "Soy Milk" },
  { id: "ing_condensed_milk", name: "Sweetened Condensed Milk" },
  { id: "ing_evap_milk", name: "Evaporated Milk" },
  { id: "ing_cream_foam", name: "Salted Cream Foam" },
  { id: "ing_salt_caramel", name: "Salted Caramel" },
  { id: "ing_vanilla_syrup", name: "Vanilla Bean Syrup" },
  { id: "ing_strawberry", name: "Strawberry Compote" },
  { id: "ing_mint", name: "Fresh Mint" },
  { id: "ing_cinnamon", name: "Ceylon Cinnamon" },
  { id: "ing_butter", name: "Normandy Butter" },
  { id: "ing_flour", name: "Artisan Flour" },
  { id: "ing_pistachio_cream", name: "Pistachio Cream" },
  { id: "ing_pistachios", name: "Crushed Pistachios" },
  { id: "ing_cheesecake", name: "Burnt Cheesecake Batter" },
  { id: "ing_cream_cheese", name: "Cream Cheese" },
  { id: "ing_cardamom", name: "Cardamom" },
  { id: "ing_brown_sugar", name: "Brown Sugar" },
  { id: "ing_pasta", name: "Fettuccine Pasta" },
  { id: "ing_truffle_cream", name: "Black Truffle Cream" },
  { id: "ing_porcini", name: "Porcini Mushrooms" },
  { id: "ing_parmesan", name: "Parmesan" },
  { id: "ing_guanciale", name: "Guanciale Pancetta" },
  { id: "ing_egg", name: "Cage-Free Eggs" },
  { id: "ing_avocado", name: "Hass Avocado" },
  { id: "ing_sourdough", name: "Sourdough" },
  { id: "ing_dukkah", name: "Dukkah Spice" },
  { id: "ing_microgreens", name: "Microgreens" },
  { id: "ing_cheese_mix", name: "Aged Cheese Blend" },
  { id: "ing_truffle_butter", name: "Truffle Butter" },
  { id: "ing_honey", name: "Artisan Honey" },
  { id: "ing_chocolate", name: "Dark Chocolate" },
  { id: "ing_coffee_jelly", name: "Artisan Coffee Jelly" },
];

type GroupId = "group_sugar" | "group_ice" | "group_milk" | "group_addons";
type OptionId = string;

interface GroupDef {
  id: GroupId;
  name: string;
  selectionMode: "SINGLE" | "MULTIPLE";
  isRequired: boolean;
  sortOrder: number;
  systemKey?: string;
}

const GROUPS: GroupDef[] = [
  { id: "group_sugar", name: "Sugar Level", selectionMode: "SINGLE", isRequired: false, sortOrder: 1, systemKey: "SUGAR" },
  { id: "group_ice", name: "Ice Level", selectionMode: "SINGLE", isRequired: false, sortOrder: 2, systemKey: "ICE" },
  { id: "group_milk", name: "Dairy / Plant Milk", selectionMode: "SINGLE", isRequired: false, sortOrder: 3 },
  { id: "group_addons", name: "Add-ons & Toppings", selectionMode: "MULTIPLE", isRequired: false, sortOrder: 4 },
];

interface OptionDef {
  id: OptionId;
  groupId: GroupId;
  name: string;
  priceModifier: number;
  ingredientId?: string;
}

const SUGAR_OPTIONS: OptionDef[] = [
  { id: "opt_sugar_no", groupId: "group_sugar", name: "No Sugar", priceModifier: 0 },
  { id: "opt_sugar_less", groupId: "group_sugar", name: "Less Sugar", priceModifier: 0 },
  { id: "opt_sugar_regular", groupId: "group_sugar", name: "Regular Sugar", priceModifier: 0 },
  { id: "opt_sugar_extra", groupId: "group_sugar", name: "Extra Sugar", priceModifier: 0 },
];

const ICE_OPTIONS: OptionDef[] = [
  { id: "opt_ice_no", groupId: "group_ice", name: "No Ice", priceModifier: 0 },
  { id: "opt_ice_less", groupId: "group_ice", name: "Less Ice", priceModifier: 0 },
  { id: "opt_ice_regular", groupId: "group_ice", name: "Regular Ice", priceModifier: 0 },
  { id: "opt_ice_extra", groupId: "group_ice", name: "Extra Ice", priceModifier: 0 },
];

const MILK_OPTIONS: OptionDef[] = [
  { id: "opt_whole_milk", groupId: "group_milk", name: "Whole Fresh Milk", priceModifier: 0, ingredientId: "ing_whole_milk" },
  { id: "opt_oat_milk", groupId: "group_milk", name: "Oat Milk", priceModifier: 25, ingredientId: "ing_oat_milk" },
  { id: "opt_almond_milk", groupId: "group_milk", name: "Almond Milk", priceModifier: 25, ingredientId: "ing_almond_milk" },
  { id: "opt_soy_milk", groupId: "group_milk", name: "Soy Milk", priceModifier: 20, ingredientId: "ing_soy_milk" },
];

const ADDON_OPTIONS: OptionDef[] = [
  { id: "opt_espresso_shot", groupId: "group_addons", name: "Extra Espresso Shot", priceModifier: 30, ingredientId: "ing_espresso" },
  { id: "opt_salt_foam", groupId: "group_addons", name: "Himalayan Sea Salt Foam", priceModifier: 25, ingredientId: "ing_cream_foam" },
  { id: "opt_coffee_jelly", groupId: "group_addons", name: "Artisan Coffee Jelly", priceModifier: 25, ingredientId: "ing_coffee_jelly" },
  { id: "opt_vanilla_syrup", groupId: "group_addons", name: "Vanilla Bean Syrup", priceModifier: 20, ingredientId: "ing_vanilla_syrup" },
  { id: "opt_whipped_butter", groupId: "group_addons", name: "Extra Whipped Butter", priceModifier: 20, ingredientId: "ing_butter" },
  { id: "opt_honey_drizzle", groupId: "group_addons", name: "Artisan Honey Drizzle", priceModifier: 20, ingredientId: "ing_honey" },
  { id: "opt_pistachios", groupId: "group_addons", name: "Crushed Roasted Pistachios", priceModifier: 30, ingredientId: "ing_pistachios" },
  { id: "opt_choc_dip", groupId: "group_addons", name: "Warm Chocolate Dip", priceModifier: 35, ingredientId: "ing_chocolate" },
];

const ALL_OPTIONS = [...SUGAR_OPTIONS, ...ICE_OPTIONS, ...MILK_OPTIONS, ...ADDON_OPTIONS];

// Per-product customization configuration.
//  - ingredients: recipe ingredients, with isBase marking the group's base
//    (e.g. base milk) and isRequired controlling product availability.
//  - groups: which customization groups the product enables.
//  - allowedOptions: the exact option ids selectable for this product, keyed
//    by optionId -> { surcharge, sortOrder }. Demonstrates the surcharge-first
//    pricing rule (ProductCustomizationOption.surcharge overrides
//    CustomizationOption.priceModifier).
interface ProductCustomizationConfig {
  ingredients: { id: string; isRequired?: boolean; isBase?: boolean }[];
  groups: { id: GroupId; sortOrder: number }[];
  allowedOptions: Record<OptionId, { surcharge: number; sortOrder: number }>;
}

const ALL_SUGAR = ["opt_sugar_no", "opt_sugar_less", "opt_sugar_regular", "opt_sugar_extra"];
const ALL_ICE = ["opt_ice_no", "opt_ice_less", "opt_ice_regular", "opt_ice_extra"];

function sugarBlock(): ProductCustomizationConfig["allowedOptions"] {
  return Object.fromEntries(ALL_SUGAR.map((id, i) => [id, { surcharge: 0, sortOrder: i + 1 }]));
}
function iceBlock(): ProductCustomizationConfig["allowedOptions"] {
  return Object.fromEntries(ALL_ICE.map((id, i) => [id, { surcharge: 0, sortOrder: 10 + i }]));
}
function addonBlock(ids: OptionId[]): ProductCustomizationConfig["allowedOptions"] {
  const byId = new Map(ADDON_OPTIONS.map((o) => [o.id, o]));
  return Object.fromEntries(
    ids.map((id, i) => {
      const priceModifier = byId.get(id)?.priceModifier ?? 0;
      return [id, { surcharge: priceModifier, sortOrder: 30 + i }];
    })
  );
}

const PRODUCT_CONFIG: Record<string, ProductCustomizationConfig> = {
  // ---------- MATCHA SERIES ----------
  prod_emerald_mint: {
    ingredients: [
      { id: "ing_matcha", isRequired: true },
      { id: "ing_oat_milk" },
      { id: "ing_mint" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_milk", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      opt_oat_milk: { surcharge: 25, sortOrder: 21 },
      opt_almond_milk: { surcharge: 25, sortOrder: 22 },
      opt_soy_milk: { surcharge: 20, sortOrder: 23 },
    },
  },
  prod_matcha_strawberry: {
    ingredients: [
      { id: "ing_matcha", isRequired: true },
      { id: "ing_strawberry" },
      { id: "ing_whole_milk" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_milk", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      opt_whole_milk: { surcharge: 0, sortOrder: 21 },
      opt_oat_milk: { surcharge: 25, sortOrder: 22 },
      opt_almond_milk: { surcharge: 25, sortOrder: 23 },
    },
  },
  prod_pure_uji_matcha: {
    ingredients: [
      { id: "ing_matcha", isRequired: true },
      { id: "ing_cream_foam" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_addons", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      ...addonBlock(["opt_vanilla_syrup", "opt_salt_foam"]),
    },
  },
  prod_matcha_espresso_fusion: {
    ingredients: [
      { id: "ing_matcha", isRequired: true },
      { id: "ing_espresso", isRequired: true },
      { id: "ing_whole_milk" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_milk", sortOrder: 3 },
      { id: "group_addons", sortOrder: 4 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      opt_whole_milk: { surcharge: 0, sortOrder: 21 },
      opt_oat_milk: { surcharge: 25, sortOrder: 22 },
      opt_almond_milk: { surcharge: 25, sortOrder: 23 },
      ...addonBlock(["opt_espresso_shot"]),
    },
  },
  prod_hojicha_latte: {
    ingredients: [
      { id: "ing_hojicha", isRequired: true },
      { id: "ing_oat_milk" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_milk", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      opt_oat_milk: { surcharge: 25, sortOrder: 21 },
      opt_almond_milk: { surcharge: 25, sortOrder: 22 },
      opt_soy_milk: { surcharge: 20, sortOrder: 23 },
    },
  },

  // ---------- COFFEE & LATTES ----------
  prod_yuenyeung: {
    ingredients: [
      { id: "ing_black_tea", isRequired: true },
      { id: "ing_espresso", isRequired: true },
      { id: "ing_evap_milk" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_milk", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      opt_whole_milk: { surcharge: 0, sortOrder: 21 },
      opt_oat_milk: { surcharge: 25, sortOrder: 22 },
      opt_almond_milk: { surcharge: 25, sortOrder: 23 },
    },
  },
  prod_spanish_latte: {
    ingredients: [
      { id: "ing_espresso", isRequired: true },
      { id: "ing_condensed_milk" },
      { id: "ing_whole_milk" },
      { id: "ing_cinnamon" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_milk", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      opt_whole_milk: { surcharge: 0, sortOrder: 21 },
      opt_oat_milk: { surcharge: 25, sortOrder: 22 },
      opt_almond_milk: { surcharge: 25, sortOrder: 23 },
    },
  },
  prod_sea_salt_cold_brew: {
    ingredients: [
      { id: "ing_cold_brew", isRequired: true },
      { id: "ing_cream_foam" },
      { id: "ing_salt_caramel" },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_ice", sortOrder: 2 },
      { id: "group_addons", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      ...iceBlock(),
      ...addonBlock(["opt_espresso_shot", "opt_vanilla_syrup"]),
    },
  },
  prod_oat_flat_white: {
    ingredients: [
      { id: "ing_espresso", isRequired: true },
      { id: "ing_oat_milk", isRequired: false, isBase: true },
    ],
    groups: [
      { id: "group_sugar", sortOrder: 1 },
      { id: "group_milk", sortOrder: 2 },
      { id: "group_addons", sortOrder: 3 },
    ],
    allowedOptions: {
      ...sugarBlock(),
      opt_oat_milk: { surcharge: 0, sortOrder: 21 },
      opt_almond_milk: { surcharge: 25, sortOrder: 22 },
      opt_soy_milk: { surcharge: 20, sortOrder: 23 },
      ...addonBlock(["opt_espresso_shot", "opt_salt_foam"]),
    },
  },
  prod_v60_filter: {
    ingredients: [
      { id: "ing_filter_beans", isRequired: true },
    ],
    groups: [
      { id: "group_addons", sortOrder: 1 },
    ],
    allowedOptions: {
      ...addonBlock(["opt_coffee_jelly"]),
    },
  },

  // ---------- PASTRIES ----------
  prod_pistachio_croissant: {
    ingredients: [
      { id: "ing_flour", isRequired: true },
      { id: "ing_butter", isRequired: true },
      { id: "ing_pistachio_cream" },
      { id: "ing_pistachios" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_pistachios", "opt_honey_drizzle"]) },
  },
  prod_butter_croissant: {
    ingredients: [
      { id: "ing_flour", isRequired: true },
      { id: "ing_butter", isRequired: true },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_whipped_butter", "opt_honey_drizzle"]) },
  },
  prod_pistachio_croissant_supreme: {
    ingredients: [
      { id: "ing_flour", isRequired: true },
      { id: "ing_butter", isRequired: true },
      { id: "ing_pistachio_cream", isRequired: true },
      { id: "ing_pistachios" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_pistachios", "opt_whipped_butter"]) },
  },
  prod_basque_cheesecake: {
    ingredients: [
      { id: "ing_cheesecake", isRequired: true },
      { id: "ing_cream_cheese", isRequired: true },
      { id: "ing_brown_sugar" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_whipped_butter", "opt_choc_dip"]) },
  },
  prod_cinnamon_cardamom_bun: {
    ingredients: [
      { id: "ing_flour", isRequired: true },
      { id: "ing_butter", isRequired: true },
      { id: "ing_cardamom" },
      { id: "ing_brown_sugar" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_honey_drizzle"]) },
  },

  // ---------- PASTA & BRUNCH ----------
  prod_truffle_pasta: {
    ingredients: [
      { id: "ing_pasta", isRequired: true },
      { id: "ing_truffle_cream", isRequired: true },
      { id: "ing_porcini" },
      { id: "ing_parmesan" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_whipped_butter", "opt_pistachios"]) },
  },
  prod_avocado_sourdough: {
    ingredients: [
      { id: "ing_sourdough", isRequired: true },
      { id: "ing_avocado", isRequired: true },
      { id: "ing_egg", isRequired: true },
      { id: "ing_dukkah" },
      { id: "ing_microgreens" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_honey_drizzle"]) },
  },
  prod_bacon_carbonara: {
    ingredients: [
      { id: "ing_pasta", isRequired: true },
      { id: "ing_guanciale", isRequired: true },
      { id: "ing_egg", isRequired: true },
      { id: "ing_parmesan" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_whipped_butter", "opt_pistachios"]) },
  },
  prod_truffle_grilled_cheese: {
    ingredients: [
      { id: "ing_sourdough", isRequired: true },
      { id: "ing_cheese_mix", isRequired: true },
      { id: "ing_truffle_butter" },
    ],
    groups: [{ id: "group_addons", sortOrder: 1 }],
    allowedOptions: { ...addonBlock(["opt_whipped_butter"]) },
  },
};

async function main() {
  // Sections run in separate small transactions to avoid the PgBouncer pooler
  // dropping long-running interactive transactions. Each upsert/delete is
  // individually atomic and the whole seed is deterministic/idempotent.
  await prisma.$transaction(async (tx) => {
    // 1) Remove stale pseudo-category "all" (UI-only sentinel; never persisted).
    const removedAll = await tx.category.deleteMany({
      where: { id: "all" },
    });
    if (removedAll.count > 0) console.log("Removed stale pseudo-category 'all'");

    // 2) Upsert real categories from menuData (excluding "all").
    //    Existing categories keep their slug (images/routes rely on it); only
    //    the display name is refreshed.
    const realCategories = PRODUCTS.map((p) => p.categoryId)
      .filter((id, i, arr) => id !== "all" && arr.indexOf(id) === i);
    for (const catId of realCategories) {
      const src = PRODUCTS.find((p) => p.categoryId === catId);
      const name = src?.categoryName || catId;
      await tx.category.upsert({
        where: { id: catId },
        update: { name },
        create: {
          id: catId,
          name,
          slug:
            catId
              .replace(/^cat_/, "")
              .replace(/_/g, "-")
              .replace(/^-|-$/g, "") || name.toLowerCase(),
          sortOrder: 0,
        },
      });
      console.log(`Category upserted: ${name}`);
    }
  }, { timeout: 60000 });

  await prisma.$transaction(async (tx) => {
    // 3) Upsert ingredients.
    for (const ing of INGREDIENTS) {
      await tx.ingredient.upsert({
        where: { id: ing.id },
        update: { name: ing.name, isAvailable: ing.isAvailable ?? true, isArchived: false },
        create: {
          id: ing.id,
          name: ing.name,
          isAvailable: ing.isAvailable ?? true,
          isArchived: false,
        },
      });
      console.log(`Ingredient upserted: ${ing.name}`);
    }
  }, { timeout: 60000 });

  await prisma.$transaction(async (tx) => {
    // 4) Upsert groups with systemKey (SUGAR/ICE).
    for (const g of GROUPS) {
      await tx.customizationGroup.upsert({
        where: { id: g.id },
        update: {
          name: g.name,
          selectionMode: g.selectionMode,
          isRequired: g.isRequired,
          sortOrder: g.sortOrder,
          systemKey: g.systemKey ?? null,
          isActive: true,
          isArchived: false,
        },
        create: {
          id: g.id,
          name: g.name,
          selectionMode: g.selectionMode,
          isRequired: g.isRequired,
          sortOrder: g.sortOrder,
          systemKey: g.systemKey,
          isActive: true,
          isArchived: false,
        },
      });
      console.log(`CustomizationGroup upserted: ${g.name} (systemKey: ${g.systemKey || "null"})`);
    }
  }, { timeout: 60000 });

  await prisma.$transaction(async (tx) => {
    // 5) Remove OLD option rows that are no longer in the canonical set
    //    (e.g. 0%/25%/50%/75%/100% sugar, Less/Regular/Extra ice, and the
    //    pre-existing milk/addon rows seeded with name-derived ids like
    //    opt_Oat_Milk). Keeps every option name unique per group ("exists
    //    exactly once"). No PCO/order-modifier rows reference them, so this
    //    is safe; new canonical options are created in step 6.
    const canonicalOptionIds = new Set(ALL_OPTIONS.map((o) => o.id));
    const staleIds = (
      await tx.customizationOption.findMany({ select: { id: true } })
    )
      .map((o) => o.id)
      .filter((id) => !canonicalOptionIds.has(id));
    if (staleIds.length > 0) {
      await tx.productCustomizationOption.deleteMany({
        where: { optionId: { in: staleIds } },
      });
      const delOpts = await tx.customizationOption.deleteMany({
        where: { id: { in: staleIds } },
      });
      console.log(`Removed ${delOpts.count} stale option(s)`);
    } else {
      console.log("No stale options to remove");
    }

    // 6) Upsert options.
    for (const opt of ALL_OPTIONS) {
      await tx.customizationOption.upsert({
        where: { id: opt.id },
        update: {
          name: opt.name,
          priceModifier: toDecimal(opt.priceModifier),
          ingredientId: opt.ingredientId ?? null,
          isActive: true,
          isArchived: false,
        },
        create: {
          id: opt.id,
          groupId: opt.groupId,
          name: opt.name,
          priceModifier: toDecimal(opt.priceModifier),
          ingredientId: opt.ingredientId,
          isActive: true,
          isArchived: false,
        },
      });
      console.log(`CustomizationOption upserted: ${opt.name}`);
    }
  }, { timeout: 60000 });

  // 7) Upsert products + their joins (one small transaction per product).
  for (const prod of PRODUCTS) {
    await prisma.$transaction(async (tx) => {
      await tx.product.upsert({
        where: { id: prod.id },
        update: {
          name: prod.name,
          description: prod.description,
          price: toDecimal(prod.price),
          imageUrl: prod.imageUrl,
          categoryId: prod.categoryId,
          manualAvailability: true,
          popular: prod.popular ?? false,
          isArchived: false,
          isAvailable: prod.isAvailable !== false,
        },
        create: {
          id: prod.id,
          name: prod.name,
          description: prod.description,
          price: toDecimal(prod.price),
          imageUrl: prod.imageUrl,
          categoryId: prod.categoryId,
          manualAvailability: true,
          popular: prod.popular ?? false,
          isArchived: false,
          isAvailable: prod.isAvailable !== false,
        },
      });

      const config: ProductCustomizationConfig = PRODUCT_CONFIG[prod.id] ?? {
        ingredients: [],
        groups: [],
        allowedOptions: {},
      };

      // Product <-> Ingredient joins (deterministic; delete stale then recreate).
      await tx.productIngredient.deleteMany({ where: { productId: prod.id } });
      for (const ing of config.ingredients) {
        await tx.productIngredient.create({
          data: {
            productId: prod.id,
            ingredientId: ing.id,
            isRequired: ing.isRequired ?? true,
            isBase: ing.isBase ?? false,
          },
        });
      }

      // Product <-> Group joins.
      const existingPcg = await tx.productCustomizationGroup.findMany({
        where: { productId: prod.id },
        select: { groupId: true },
      });
      const existingGroupSet = new Set(existingPcg.map((g) => g.groupId));
      for (const g of config.groups) {
        if (!existingGroupSet.has(g.id)) {
          await tx.productCustomizationGroup.create({
            data: { productId: prod.id, groupId: g.id, sortOrder: g.sortOrder },
          });
        } else {
          await tx.productCustomizationGroup.update({
            where: { productId_groupId: { productId: prod.id, groupId: g.id } },
            data: { sortOrder: g.sortOrder },
          });
        }
      }
      // Remove group links no longer configured for this product.
      const desiredGroupSet = new Set<string>(config.groups.map((g) => g.id));
      const staleGroups = existingPcg
        .map((g) => g.groupId)
        .filter((id) => !desiredGroupSet.has(id));
      if (staleGroups.length > 0) {
        await tx.productCustomizationGroup.deleteMany({
          where: { productId: prod.id, groupId: { in: staleGroups } },
        });
      }

      // Product <-> Option joins (allowed options with surcharge/sortOrder).
      await tx.productCustomizationOption.deleteMany({ where: { productId: prod.id } });
      for (const [optId, { surcharge, sortOrder }] of Object.entries(
        config.allowedOptions
      )) {
        await tx.productCustomizationOption.create({
          data: {
            productId: prod.id,
            optionId: optId,
            surcharge: toDecimal(surcharge),
            sortOrder,
          },
        });
      }

      console.log(`Product upserted: ${prod.name} (${config.ingredients.length} ingredients, ${config.allowedOptions ? Object.keys(config.allowedOptions).length : 0} options)`);
    }, { timeout: 60000 });
  }

  // 8) No promotions; orders intentionally left untouched (must remain 0).

  const counts = {
    categories: await prisma.category.count(),
    ingredients: await prisma.ingredient.count(),
    customizationGroups: await prisma.customizationGroup.count(),
    customizationOptions: await prisma.customizationOption.count(),
    products: await prisma.product.count(),
    productIngredients: await prisma.productIngredient.count(),
    productCustomizationGroups: await prisma.productCustomizationGroup.count(),
    productCustomizationOptions: await prisma.productCustomizationOption.count(),
    orders: await prisma.order.count(),
    promotions: await prisma.promotion.count(),
  };
  console.log("\n=== SEED COMPLETE ===");
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
