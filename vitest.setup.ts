import { inject } from 'vitest';

process.env.MONGO_URL = inject('MONGO_BASE_URI'); // from globalSetup
