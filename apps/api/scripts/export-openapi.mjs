#!/usr/bin/env node
// Writes the API's OpenAPI document to docs/openapi.json (committed, so the
// spec can be read or imported into Postman without running the API).
//
//   npm run docs:openapi --workspace=apps/api      (the API must be running)
//
// Run it after changing routes or DTOs, and commit the result.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const API = process.env.API_URL ?? 'http://localhost:3000';
const out = fileURLToPath(new URL('../../../docs/openapi.json', import.meta.url));

const res = await fetch(`${API}/api-docs-json`).catch(() => null);
if (!res?.ok) {
  console.error(`Could not read ${API}/api-docs-json — is the API running (make dev-api)?`);
  process.exit(1);
}
const doc = await res.json();

// Guard against exporting a document built without the Swagger compiler
// plugin (e.g. a watch process started before nest-cli.json changed):
// its request schemas would have no fields.
const empty = Object.entries(doc.components?.schemas ?? {})
  .filter(([, s]) => !Object.keys(s.properties ?? {}).length)
  .map(([name]) => name);
if (empty.length) {
  console.error(`Schemas without fields: ${empty.join(', ')}`);
  console.error('Restart the API (Ctrl+C, make dev-api) so the Swagger plugin runs, then try again.');
  process.exit(1);
}

await writeFile(out, `${JSON.stringify(doc, null, 2)}\n`);
console.log(
  `Wrote ${out}: ${Object.keys(doc.paths).length} routes, ${Object.keys(doc.components.schemas).length} schemas`,
);
