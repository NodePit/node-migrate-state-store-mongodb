import { inject } from 'vitest';

// @ts-ignore
process.env.MONGO_URL = inject('MONGO_BASE_URI'); // from globalSetup
