export function getSafeRedirectPath(rawRedirect: string | null): string | null {
  if (!rawRedirect || !rawRedirect.startsWith("/") || rawRedirect.startsWith("//")) {
    return null;
  }

  return rawRedirect;
}

export function getSafeRedirectPathFromUrl(rawRedirectUrl: string | null, origin: string): string | null {
  if (!rawRedirectUrl) {
    return null;
  }

  try {
    const redirectUrl = new URL(rawRedirectUrl, origin);

    if (redirectUrl.origin !== origin) {
      return null;
    }

    return getSafeRedirectPath(`${redirectUrl.pathname}${redirectUrl.search}`);
  } catch {
    return null;
  }
}

export function getRequestedRedirectPath(
  searchParams: URLSearchParams,
  origin?: string,
): string | null {
  const canonicalRedirect = getSafeRedirectPath(searchParams.get("redirect"));
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  // Backward compatibility for older callback links that still use `next`.
  const legacyRedirect = getSafeRedirectPath(searchParams.get("next"));
  if (legacyRedirect) {
    return legacyRedirect;
  }

  if (origin) {
    return getSafeRedirectPathFromUrl(searchParams.get("redirect_to"), origin);
  }

  return null;
}
