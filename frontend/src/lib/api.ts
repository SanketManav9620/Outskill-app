/**
 * Utility helper to retrieve the sanitized backend API URL.
 * Strips any trailing slashes to prevent double-slash (`//api/...`) 404 routing errors.
 */
export const getBackendUrl = (): string => {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  return rawUrl.replace(/\/+$/, '');
};
