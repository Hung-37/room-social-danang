import { assertProductionCredentials } from './lib/server/runtime-credentials.js';

export function register() {
  try {
    assertProductionCredentials();
  } catch (error) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      console.error(error instanceof Error ? error.message : 'Invalid production credentials.');
      process.exit(1);
    }
    throw error;
  }
}
