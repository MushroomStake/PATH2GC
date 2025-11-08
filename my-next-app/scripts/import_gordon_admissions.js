#!/usr/bin/env node
/*
  Safe import script for Gordon College admissions scraped data.
  Reads `data/sources/gordon-admissions-scraped.json` and inserts rows into
  `faqs` and `admission_steps` using SUPABASE_SERVICE_ROLE.

  IMPORTANT: This script will NOT run automatically. To run locally set the
  following env vars in your shell and execute this file with node:

    set SUPABASE_URL=https://your-supabase-url
    set SUPABASE_SERVICE_ROLE=your-service-role-key
    node scripts/import_gordon_admissions.js

  The script is conservative: it inserts FAQ entries for each scraped section
  and also inserts admission_steps entries with `title` and `description`.
  It prints a summary and the generated payloads. Review before running.
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

  if (!SUPABASE_SERVICE_ROLE || !SUPABASE_URL) {
    console.error('Missing SUPABASE_SERVICE_ROLE or SUPABASE_URL environment variables. Aborting.');
    console.error('Set SUPABASE_SERVICE_ROLE and SUPABASE_URL before running this script.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    // use the Node fetch polyfill from the environment
  });

  const filePath = path.resolve(__dirname, '../data/sources/gordon-admissions-scraped.json');
  if (!fs.existsSync(filePath)) {
    console.error('Data file not found:', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let pages;
  try { pages = JSON.parse(raw); } catch (e) { console.error('Failed to parse JSON', e); process.exit(1); }

  const faqs = [];
  const steps = [];

  // Assign incremental step_order values to avoid NOT NULL constraints
  let stepCounter = 1;
  for (const page of pages) {
    const pageTitle = page.title || page.url;
    for (const sec of (page.sections || [])) {
      const heading = sec.heading || 'General';
      const content = sec.content || '';

      faqs.push({ question: `${pageTitle} — ${heading}`, answer: content, source_url: page.url });

      // Create an admission_steps row with an incremental step_order
      steps.push({ step_order: stepCounter++, title: heading, description: content, checklist: null, source_url: page.url });
    }
  }

  console.log(`Prepared ${faqs.length} FAQ rows and ${steps.length} admission_steps rows.`);

  // Show a preview and ask the user to confirm before performing inserts
  console.log('Preview (first 3 FAQ rows):', JSON.stringify(faqs.slice(0,3), null, 2));
  console.log('Preview (first 3 step rows):', JSON.stringify(steps.slice(0,3), null, 2));

  // Ask for confirmation via environment flag to avoid accidental writes
  if (process.env.CONFIRM_IMPORT !== '1') {
    console.log('\nThis script will NOT write to the database unless you set the environment variable CONFIRM_IMPORT=1');
    console.log('If you want to proceed, re-run the script like:');
    console.log('\n  set SUPABASE_URL=...');
    console.log('  set SUPABASE_SERVICE_ROLE=...');
    console.log('  set CONFIRM_IMPORT=1');
    console.log('  node scripts/import_gordon_admissions.js\n');
    process.exit(0);
  }

  try {
    // Insert faqs in batches to avoid large payloads
    const chunk = (arr, n=100) => {
      const out = [];
      for (let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n));
      return out;
    };

    for (const batch of chunk(faqs, 200)) {
      const { error } = await supabase.from('faqs').insert(batch);
      if (error) throw error;
    }

    for (const batch of chunk(steps, 200)) {
      // For admission_steps the table may expect step_order as integer; we'll insert nulls where unknown
      const payload = batch.map(s => ({ step_order: s.step_order, title: s.title, description: s.description, checklist: s.checklist }));
      const { error } = await supabase.from('admission_steps').insert(payload);
      if (error) throw error;
    }

    console.log('Import completed successfully.');
  } catch (e) {
    console.error('Import failed', e);
    process.exit(1);
  }
}

main();
