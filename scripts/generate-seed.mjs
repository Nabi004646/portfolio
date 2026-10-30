import { writeFile } from 'node:fs/promises';
import { defaultContent } from '../src/content.js';

const quote = value => `'${String(value).replaceAll("'", "''")}'`;
let sql = '-- Generated from src/content.js. Seed once; this never overwrites existing edits.\n';
for (const row of defaultContent) {
  sql += `insert into public.content_items(id,kind,title,slug,is_published,sort_order,data) values (${[quote(row.id), quote(row.kind), quote(row.title), quote(row.slug), String(row.is_published), row.sort_order, quote(JSON.stringify(row.data)) + '::jsonb'].join(',')}) on conflict (id) do nothing;\n`;
}
await writeFile('supabase/seed.sql', sql);
console.log(`Prepared ${defaultContent.length} content records.`);
