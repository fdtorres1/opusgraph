export function getSafeRedirectPath(rawRedirect: string | null): string | null {
  if (!rawRedirect || !rawRedirect.startsWith("/") || rawRedirect.startsWith("//")) {
    return null;
  }

  return rawRedirect;
}

export function getRequestedRedirectPath(searchParams: URLSearchParams): string | null {
  const canonicalRedirect = getSafeRedirectPath(searchParams.get("redirect"));
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  // Backward compatibility for older callback links that still use `next`.
  return getSafeRedirectPath(searchParams.get("next"));
}
