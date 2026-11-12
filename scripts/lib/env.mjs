import { createRequire } from 'node:module';
const nextRequire = createRequire(import.meta.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(process.cwd(), false);
