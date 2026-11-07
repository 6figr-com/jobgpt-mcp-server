import { readFileSync } from 'fs';
import { SERVER_VERSION } from '../dist/version.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

test('version strings agree', () => {
  const pkg = read('../package.json');
  const server = read('../server.json');
  expect(SERVER_VERSION).toBe(pkg.version);
  expect(server.version).toBe(pkg.version);
  expect(server.packages[0].version).toBe(pkg.version);
});
