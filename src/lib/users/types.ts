export type UsersActionState = {
  error?: string;
  success?: string;
  userId?: string;
};

export type TeamMemberRow = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  spaceLabel: string;
  establishmentId: string;
  establishmentName: string;
  status: "active" | "inactive";
  mustChangePassword: boolean;
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
  email: string;
  spaceLabel: string;
  establishmentName: string;
  temporaryPassword: string;
};

export type FirstLoginContext = {
  fullName: string;
  email: string;
  establishmentName: string;
  spaceLabel: string;
};
