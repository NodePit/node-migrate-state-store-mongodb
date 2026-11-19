import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    // loaded by migrate from its migrationsDirectory, not imported
    'test/migrations/*.js'
  ]
};

export default config;
