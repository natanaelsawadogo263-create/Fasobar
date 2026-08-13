import "server-only";

import { cache } from "react";

import { getCatalogFormProfile } from "@/lib/activity/catalog";
import { isRetailActivity } from "@/lib/activity/profile";
import { slugifyFromName } from "@/lib/auth/slugs";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { getDepartmentIdByCode, listCategories } from "@/lib/products/queries";
import type { CategoryOption } from "@/lib/products/types";
import { createClient } from "@/lib/supabase/server";

const ENSURE_TTL_MS = 120_000;
const ensureOkUntil = new Map<string, number>();

/**
 * Crée les rayons métier manquants (une insertion groupée).
 * No-op restaurant. TTL pour ne pas rejouer à chaque navigation.
 */
export const ensureRetailCategories = cache(async function ensureRetailCategories(
  workspace: WorkspaceContext,
): Promise<CategoryOption[]> {
  if (!isRetailActivity(workspace.activityCode)) {
    return listCategories(workspace);
  }

  const catalog = getCatalogFormProfile(workspace.activityCode);
  const existing = await listCategories(workspace);
  const until = ensureOkUntil.get(workspace.establishmentId) ?? 0;
  if (until > Date.now()) {
    return existing;
  }

  const departmentId = await getDepartmentIdByCode(workspace, "BAR");
  if (!departmentId || catalog.suggestedCategories.length === 0) {
    ensureOkUntil.set(workspace.establishmentId, Date.now() + ENSURE_TTL_MS);
    return existing;
  }

  const known = new Set(existing.map((item) => item.name.trim().toLowerCase()));
  const missing = catalog.suggestedCategories.filter(
    (name) => !known.has(name.trim().toLowerCase()),
  );

  if (missing.length === 0) {
    ensureOkUntil.set(workspace.establishmentId, Date.now() + ENSURE_TTL_MS);
    return existing;
  }

  const rows = missing
    .map((name) => {
      const slug = slugifyFromName(name);
      if (!slug) return null;
      return {
        organization_id: workspace.organizationId,
        establishment_id: workspace.establishmentId,
        department_id: departmentId,
        name,
        slug,
        active: true,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    ensureOkUntil.set(workspace.establishmentId, Date.now() + ENSURE_TTL_MS);
    return existing;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert(rows);
  if (error) {
    console.warn("[ensureRetailCategories]", error.message);
  }

  ensureOkUntil.set(workspace.establishmentId, Date.now() + ENSURE_TTL_MS);
  return listCategories(workspace);
});
