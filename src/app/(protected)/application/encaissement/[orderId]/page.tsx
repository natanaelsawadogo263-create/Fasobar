import { redirect } from "next/navigation";

type EncaissementPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

/** L’encaissement se fait désormais via la modale de la caisse. */
export default async function EncaissementPage({ params }: EncaissementPageProps) {
  const { orderId } = await params;
  redirect(`/application/caisse?order=${orderId}`);
}
