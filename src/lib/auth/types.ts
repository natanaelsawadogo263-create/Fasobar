export type AuthActionState = {
  error?: string;
  success?: string;
  recoveryLink?: string;
  /** Inscription en attente : adresse à laquelle le lien de confirmation a été envoyé. */
  pendingConfirmationEmail?: string;
};
