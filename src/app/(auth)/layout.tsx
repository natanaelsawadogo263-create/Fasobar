export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50">
      <div className="mx-auto flex min-h-full w-full items-center justify-center px-4 py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
