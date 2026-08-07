-- FasoBar: lecture data plane pour Super Admin actif
-- À appliquer manuellement. Ne pas exécuter automatiquement.
--
-- Sans ces policies, /platform/clients voit les états SaaS mais pas
-- les noms d'organisations, OWNER, établissements ni employés
-- (RLS multi-tenant limité aux membres de l'org).

-- organizations
DROP POLICY IF EXISTS organizations_select_platform_admin ON public.organizations;
CREATE POLICY organizations_select_platform_admin
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_active_platform_admin());

-- establishments
DROP POLICY IF EXISTS establishments_select_platform_admin ON public.establishments;
CREATE POLICY establishments_select_platform_admin
  ON public.establishments
  FOR SELECT
  TO authenticated
  USING (public.is_active_platform_admin());

-- organization_memberships
DROP POLICY IF EXISTS organization_memberships_select_platform_admin
  ON public.organization_memberships;
CREATE POLICY organization_memberships_select_platform_admin
  ON public.organization_memberships
  FOR SELECT
  TO authenticated
  USING (public.is_active_platform_admin());

-- establishment_memberships
DROP POLICY IF EXISTS establishment_memberships_select_platform_admin
  ON public.establishment_memberships;
CREATE POLICY establishment_memberships_select_platform_admin
  ON public.establishment_memberships
  FOR SELECT
  TO authenticated
  USING (public.is_active_platform_admin());

-- profiles (noms / téléphones des OWNER et employés)
DROP POLICY IF EXISTS profiles_select_platform_admin ON public.profiles;
CREATE POLICY profiles_select_platform_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_active_platform_admin());

COMMENT ON POLICY organizations_select_platform_admin ON public.organizations IS
  'Super Admin actif : lecture cross-tenant des organisations clientes.';

COMMENT ON POLICY profiles_select_platform_admin ON public.profiles IS
  'Super Admin actif : lecture des profils pour la fiche client plateforme.';
