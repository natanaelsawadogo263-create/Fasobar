import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SolutionSectorPage } from "@/components/marketing/solution-sector-page";
import { getSolutionSector, SOLUTION_SECTORS } from "@/lib/marketing/solutions";
import { buildPageMetadata } from "@/lib/marketing/seo";

type PageParams = { slug: string };

export function generateStaticParams(): PageParams[] {
  return SOLUTION_SECTORS.map((sector) => ({ slug: sector.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sector = getSolutionSector(slug);
  if (!sector) return {};

  return buildPageMetadata({
    path: `/solutions/${sector.slug}`,
    title: sector.title,
    description: sector.metaDescription,
  });
}

export default async function SolutionSlugPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;
  const sector = getSolutionSector(slug);
  if (!sector) notFound();

  return <SolutionSectorPage sector={sector} />;
}
