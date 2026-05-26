declare module '@/utils/csrf' {
  export function setCSRFToken(token: string | null): void;
  export function getCSRFToken(): string | null;
}