import 'server-only';
import pino from 'pino';

/**
 * Logger server terpusat dengan redaksi data sensitif di sumber (SECURITY.md S-12).
 * Dilarang mencatat isi PDF, hasil ekstraksi mentah, nomor rekening penuh, token, atau nilai nominal.
 */
export const REDACT_PATHS: string[] = [
  'password',
  '*.password',
  'token',
  '*.token',
  'access_token',
  '*.access_token',
  'req.headers.authorization',
  'req.headers.cookie',
  'accountNo',
  '*.accountNo',
  'account_no',
  '*.account_no',
  'senderAccount',
  '*.senderAccount',
  'recipientAccount',
  '*.recipientAccount',
  'parse_result',
  '*.parse_result',
  'rawText',
  '*.rawText',
  'text',
  '*.text',
  'base64',
  '*.base64',
  'imageData',
  '*.imageData',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
});
