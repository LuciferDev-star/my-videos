// Lightest reasonable gate for a single non-technical editor behind an
// unlisted URL - a shared password over HTTPS, not a per-user account
// system. Uses atob() (Edge-runtime compatible) instead of Node's Buffer.
export function isAuthorized(authorizationHeader: string | null): boolean {
  const username = process.env.EDITOR_APP_USERNAME;
  const password = process.env.EDITOR_APP_PASSWORD;

  // Fail closed: an unconfigured password locks the app out, not open.
  if (!username || !password) {
    return false;
  }

  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
    return false;
  }

  let decoded: string;
  try {
    decoded = atob(authorizationHeader.slice("Basic ".length));
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return false;
  }

  const suppliedUsername = decoded.slice(0, separatorIndex);
  const suppliedPassword = decoded.slice(separatorIndex + 1);

  return suppliedUsername === username && suppliedPassword === password;
}
