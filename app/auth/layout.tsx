// Force dynamic rendering for auth pages to ensure Supabase client
// has access to environment variables at runtime
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

