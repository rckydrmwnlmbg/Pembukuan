export interface RouteViolation {
  file: string;
  reason: string;
}

export const ALLOWED_UNWRAPPED_ROUTES: Set<string>;

export function scanApiRoutes(rootDir?: string): {
  scannedCount: number;
  violations: RouteViolation[];
};
