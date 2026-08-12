export type UsersActionState = {
  error?: string;
  success?: string;
  userId?: string;
};

export type TeamMemberRow = {
  id: string;
  userId: string;
  fullName: string;
  /** Identifiant FasoBar ; e-mail legacy seulement si pas d'identifiant. */
  loginIdentifier: string;
  email: string;
  phone: string | null;
  role: string;
  spaceLabel: string;
  establishmentId: string;
  establishmentName: string;
  status: "active" | "inactive";
  mustChangePassword: boolean;
  credentialVersion: number;
  createdAt: string;
};

export type UsersPageData = {
  members: TeamMemberRow[];
  establishments: Array<{ id: string; name: string }>;
  stats: {
    activeUsers: number;
    cashierKitchenCount: number;
    barManagerCount: number;
    mustChangePasswordCount: number;
    inactiveUsers: number;
  };
};

export type CreatedCredentialsSummary = {
  fullName: string;
  /** Identifiant FasoBar (pas l'e-mail Auth interne). */
  loginIdentifier: string;
  spaceLabel: string;
  establishmentName: string;
  temporaryPassword: string;
};

export type FirstLoginContext = {
  fullName: string;
  /** Affiché à l'employé — identifiant FasoBar ou e-mail legacy. */
  loginIdentifier: string;
  establishmentName: string;
  spaceLabel: string;
};
