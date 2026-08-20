export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Auth déjà couverte par requireWorkspaceContext / pages enfants (cache React).
  // Évite un getUser() sérialisé avant chaque navigation /application.
  return <>{children}</>;
}
