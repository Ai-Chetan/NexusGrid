declare module '@/utils/csrf' {
  export function fetchCSRFToken(): Promise<string | null>;
  export function setCSRFToken(token: string | null): void;
  export function getCSRFToken(): string | null;
}