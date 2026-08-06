import type { DepartmentCode } from "@/lib/products/schemas";
import type { ProductUnit } from "@/lib/products/schemas";

export type CaisseCatalogCategory = {
  name: string;
  slug: string;
  departmentCode: DepartmentCode;
};

export type CaisseCatalogProduct = {
  name: string;
  slug: string;
  departmentCode: DepartmentCode;
  categoryName: string;
  sellingPrice: number;
  unit: ProductUnit;
  imageFile: string;
};

export const CAISSE_CATEGORIES: CaisseCatalogCategory[] = [
  { name: "Bières", slug: "bieres", departmentCode: "BAR" },
  { name: "Sodas", slug: "sodas", departmentCode: "BAR" },
  { name: "Eaux", slug: "eaux", departmentCode: "BAR" },
  { name: "Spiritueux", slug: "spiritueux", departmentCode: "BAR" },
  { name: "Jus & Boissons", slug: "jus-boissons", departmentCode: "BAR" },
  { name: "Plats", slug: "plats", departmentCode: "KITCHEN" },
  { name: "Accompagnements", slug: "accompagnements", departmentCode: "KITCHEN" },
  { name: "Desserts", slug: "desserts", departmentCode: "KITCHEN" },
];

export const CAISSE_PRODUCTS: CaisseCatalogProduct[] = [
  {
    name: "BRAKINA",
    slug: "brakina",
    departmentCode: "BAR",
    categoryName: "Bières",
    sellingPrice: 500,
    unit: "BOTTLE",
    imageFile: "brakina.jpg",
  },
  {
    name: "CASTEL",
    slug: "castel",
    departmentCode: "BAR",
    categoryName: "Bières",
    sellingPrice: 600,
    unit: "BOTTLE",
    imageFile: "castel.jpg",
  },
  {
    name: "GUINNESS",
    slug: "guinness",
    departmentCode: "BAR",
    categoryName: "Bières",
    sellingPrice: 1000,
    unit: "BOTTLE",
    imageFile: "guinness.jpg",
  },
  {
    name: "HEINEKEN",
    slug: "heineken",
    departmentCode: "BAR",
    categoryName: "Bières",
    sellingPrice: 1000,
    unit: "BOTTLE",
    imageFile: "heineken.jpg",
  },
  {
    name: "COCA-COLA",
    slug: "coca-cola",
    departmentCode: "BAR",
    categoryName: "Sodas",
    sellingPrice: 500,
    unit: "BOTTLE",
    imageFile: "coca-cola.jpg",
  },
  {
    name: "FANTA ORANGE",
    slug: "fanta-orange",
    departmentCode: "BAR",
    categoryName: "Sodas",
    sellingPrice: 500,
    unit: "BOTTLE",
    imageFile: "fanta-orange.jpg",
  },
  {
    name: "EAU MINÉRALE 50cl",
    slug: "eau-minerale-50cl",
    departmentCode: "BAR",
    categoryName: "Eaux",
    sellingPrice: 300,
    unit: "BOTTLE",
    imageFile: "eau-minerale.jpg",
  },
  {
    name: "POULET BRAISÉ",
    slug: "poulet-braise",
    departmentCode: "KITCHEN",
    categoryName: "Plats",
    sellingPrice: 2000,
    unit: "PORTION",
    imageFile: "poulet-braise.jpg",
  },
  {
    name: "RIZ SAUCE",
    slug: "riz-sauce",
    departmentCode: "KITCHEN",
    categoryName: "Plats",
    sellingPrice: 1500,
    unit: "PORTION",
    imageFile: "riz-sauce.jpg",
  },
  {
    name: "ATTIÉKÉ POISSON",
    slug: "attieke-poisson",
    departmentCode: "KITCHEN",
    categoryName: "Plats",
    sellingPrice: 2000,
    unit: "PORTION",
    imageFile: "attieke-poisson.jpg",
  },
  {
    name: "HARICOTS SAUCE",
    slug: "haricots-sauce",
    departmentCode: "KITCHEN",
    categoryName: "Plats",
    sellingPrice: 1200,
    unit: "PORTION",
    imageFile: "haricots-sauce.jpg",
  },
  {
    name: "SUCRERIE",
    slug: "sucrerie",
    departmentCode: "KITCHEN",
    categoryName: "Accompagnements",
    sellingPrice: 200,
    unit: "PORTION",
    imageFile: "sucrerie.jpg",
  },
  {
    name: "FLAG",
    slug: "flag",
    departmentCode: "BAR",
    categoryName: "Bières",
    sellingPrice: 500,
    unit: "BOTTLE",
    imageFile: "brakina.jpg",
  },
  {
    name: "SPRITE",
    slug: "sprite",
    departmentCode: "BAR",
    categoryName: "Sodas",
    sellingPrice: 500,
    unit: "BOTTLE",
    imageFile: "coca-cola.jpg",
  },
  {
    name: "EVIAN 50cl",
    slug: "evian-50cl",
    departmentCode: "BAR",
    categoryName: "Eaux",
    sellingPrice: 400,
    unit: "BOTTLE",
    imageFile: "eau-minerale.jpg",
  },
  {
    name: "RHUM BLANC",
    slug: "rhum-blanc",
    departmentCode: "BAR",
    categoryName: "Spiritueux",
    sellingPrice: 1500,
    unit: "BOTTLE",
    imageFile: "castel.jpg",
  },
  {
    name: "VODKA",
    slug: "vodka",
    departmentCode: "BAR",
    categoryName: "Spiritueux",
    sellingPrice: 2000,
    unit: "BOTTLE",
    imageFile: "castel.jpg",
  },
  {
    name: "JUS D'ORANGE",
    slug: "jus-orange",
    departmentCode: "BAR",
    categoryName: "Jus & Boissons",
    sellingPrice: 700,
    unit: "BOTTLE",
    imageFile: "fanta-orange.jpg",
  },
  {
    name: "JUS DE BISSAP",
    slug: "jus-bissap",
    departmentCode: "BAR",
    categoryName: "Jus & Boissons",
    sellingPrice: 600,
    unit: "BOTTLE",
    imageFile: "fanta-orange.jpg",
  },
  {
    name: "BROCHETTE DE BŒUF",
    slug: "brochette-boeuf",
    departmentCode: "KITCHEN",
    categoryName: "Plats",
    sellingPrice: 2500,
    unit: "PORTION",
    imageFile: "poulet-braise.jpg",
  },
  {
    name: "FRITURE DE POISSON",
    slug: "friture-poisson",
    departmentCode: "KITCHEN",
    categoryName: "Plats",
    sellingPrice: 2200,
    unit: "PORTION",
    imageFile: "attieke-poisson.jpg",
  },
  {
    name: "FRITE",
    slug: "frite",
    departmentCode: "KITCHEN",
    categoryName: "Accompagnements",
    sellingPrice: 500,
    unit: "PORTION",
    imageFile: "sucrerie.jpg",
  },
  {
    name: "TIRAMISU",
    slug: "tiramisu",
    departmentCode: "KITCHEN",
    categoryName: "Desserts",
    sellingPrice: 800,
    unit: "PORTION",
    imageFile: "sucrerie.jpg",
  },
];

export const CAISSE_DEMO_TABLE = "T12, Terrasse 3";

export const CAISSE_DEMO_CART: Array<{ slug: string; quantity: number }> = [
  { slug: "brakina", quantity: 2 },
  { slug: "poulet-braise", quantity: 1 },
  { slug: "eau-minerale-50cl", quantity: 1 },
];

export const CAISSE_PRODUCT_ORDER = CAISSE_PRODUCTS.map((product) => product.slug);
