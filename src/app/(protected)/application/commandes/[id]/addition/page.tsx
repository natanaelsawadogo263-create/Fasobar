import { redirect } from "next/navigation";

type AdditionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderAdditionRedirectPage({
  params,
}: AdditionPageProps) {
  const { id } = await params;
  redirect(`/application/caisse/addition/${id}`);
}
