#!/usr/bin/env node
/**
 * Runs before `next build` on Vercel: applies any new supabase/migrations to the hosted Supabase database and,
 * if the demo accounts don't exist yet, loads supabase/seed.sql. Safe to run on every deploy.
 *
 * Database URL: SUPABASE_DB_URL, else the Supabase-Vercel integration's POSTGRES_URL_NON_POOLING / POSTGRES_URL.
 * With no database URL it does nothing (e.g. local builds).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.log("db-deploy: no database URL set, skipping migrations and seed.");
  process.exit(0);
}

const root = path.resolve(import.meta.dirname, "..");
const local = /localhost|127\.0\.0\.1/.test(url);
// Supabase's pooler URLs carry ?sslmode=require; pg wants an explicit ssl option instead.
const connectionString = url.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
const client = new pg.Client({ connectionString, ssl: local ? false : { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  await client.query(`create schema if not exists thaali_meta;
    revoke all on schema thaali_meta from public;
    create table if not exists thaali_meta.migrations (name text primary key, applied_at timestamptz not null default now());`);
  const done = new Set((await client.query("select name from thaali_meta.migrations")).rows.map((r) => r.name));
  const files = readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    console.log(`db-deploy: applying ${f}`);
    const sql = readFileSync(path.join(root, "supabase/migrations", f), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into thaali_meta.migrations (name) values ($1)", [f]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw new Error(`migration ${f} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  const { rows } = await client.query("select count(*)::int n from auth.users where email = 'admin@demo.in'");
  if (rows[0].n === 0) {
    console.log("db-deploy: loading demo data (supabase/seed.sql)…");
    await client.query(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  }
  // Let the REST API see new tables/functions straight away.
  await client.query("notify pgrst, 'reload schema'");
  console.log(`db-deploy: database ready (${files.length - done.size} new migration(s)).`);
}

main()
  .catch((e) => {
    console.error(`db-deploy: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  })
  .finally(() => client.end());
