"use client";

import { useTransition, type FormEvent, type ReactNode } from "react";

import { signOutAction } from "@/lib/auth/actions";

type SignOutFormProps = {
  children: ReactNode;
  className?: string;
};

export function SignOutForm({ children, className }: SignOutFormProps) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await signOutAction();
      } catch {
        // redirect() lève une exception côté client — navigation de secours.
      }
      window.location.assign("/");
    });
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
