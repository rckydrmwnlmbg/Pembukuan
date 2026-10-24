export interface SecretViolation {
  file: string;
  reason: string;
}

export function scanSecrets(rootDir?: string): {
  scannedCount: number;
  violations: SecretViolation[];
};
