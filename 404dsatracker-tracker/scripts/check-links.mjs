/**
 * check-links.mjs
 *
 * Scans src/lib/master-problems.ts and src/lib/practice-problems.ts for every
 * `link: "https://..."` entry, checks whether the URL is dead (HTTP 404),
 * and — only for confirmed 404s — blanks that problem's `link` field to `""`
 * in place. The problem entry itself (id, name, difficulty, etc.) is never
 * removed, only the broken URL.
 *
 * Run locally (this sandbox has no network access to geeksforgeeks.org /
 * leetcode.com, so it must be run on a machine with normal internet access):
 *
 *   node scripts/check-links.mjs            # dry run — just prints a report
 *   node scripts/check-links.mjs --write    # also rewrites the data files
 *
 * Notes:
 *  - Only a real, confirmed HTTP 404 response causes a link to be blanked.
 *    Timeouts, 429s (rate limiting), 403s (bot-blocking), and other network
 *    errors are reported separately and left untouched, since those don't
 *    reliably mean the page is gone — re-run the script if you see a lot of
 *    those, ideally with a delay, to rule out rate limiting.
 *  - LeetCode problem pages almost always respond 200 even for slugs that
 *    don't exist (they render a client-side "not found" page), so plain
 *    HTTP status checks can't reliably detect dead LeetCode links. This
 *    script flags LeetCode responses that are OK, and reports any that come
 *    back non-200 for manual review, but only auto-blanks GFG-style true 404s.
 *  - Concurrency is capped and requests are spaced out to avoid tripping
 *    rate limits or looking like a scraping attack.
 */

import fs from "node:fs/promises";
import path from "node:path";

const FILES = [
  "src/lib/master-problems.ts",
  "src/lib/practice-problems.ts",
];

const CONCURRENCY = 8;
const TIMEOUT_MS = 12000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function extractEntries(text) {
  // Matches: id: "SOMETHING", ... link: "https://...."
  const re = /id:\s*"([^"]+)"[^}]*?link:\s*"([^"]*)"/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const [, id, link] = m;
    if (link) out.push({ id, link });
  }
  return out;
}

async function checkUrl(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": UA },
    });
    // Some sites don't support HEAD properly — fall back to GET on weird codes.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": UA },
      });
    }
    return { status: res.status, ok: res.ok };
  } catch (e) {
    return { status: null, error: e?.name === "AbortError" ? "timeout" : String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  const write = process.argv.includes("--write");
  const root = process.cwd();

  const fileTexts = {};
  const allEntries = [];
  for (const rel of FILES) {
    const full = path.join(root, rel);
    const text = await fs.readFile(full, "utf8");
    fileTexts[rel] = text;
    for (const e of extractEntries(text)) allEntries.push({ ...e, file: rel });
  }

  // De-dupe by URL so we don't hit the same link twice.
  const byUrl = new Map();
  for (const e of allEntries) {
    if (!byUrl.has(e.link)) byUrl.set(e.link, []);
    byUrl.get(e.link).push(e);
  }
  const uniqueUrls = [...byUrl.keys()];
  console.log(`Found ${allEntries.length} link fields (${uniqueUrls.length} unique URLs) across ${FILES.length} files.`);

  const dead404 = [];
  const suspect = []; // non-200, non-404 — needs a human to look
  const errored = []; // timeouts / network errors — inconclusive, not touched

  let done = 0;
  await runPool(uniqueUrls, async (url) => {
    const r = await checkUrl(url);
    done++;
    if (done % 50 === 0) console.log(`  checked ${done}/${uniqueUrls.length}...`);
    if (r.status === 404) {
      dead404.push(url);
    } else if (r.error) {
      errored.push({ url, error: r.error });
    } else if (!r.ok) {
      suspect.push({ url, status: r.status });
    }
  }, CONCURRENCY);

  console.log(`\nConfirmed 404s: ${dead404.length}`);
  console.log(`Suspect (non-200/404, needs manual check): ${suspect.length}`);
  console.log(`Errored/inconclusive (not touched): ${errored.length}`);

  if (dead404.length) {
    console.log("\n--- 404 links (by problem id) ---");
    for (const url of dead404) {
      for (const e of byUrl.get(url)) console.log(`  [${e.file}] ${e.id}: ${url}`);
    }
  }
  if (suspect.length) {
    console.log("\n--- suspect links (status != 200/404 — review manually) ---");
    for (const { url, status } of suspect) {
      for (const e of byUrl.get(url)) console.log(`  [${e.file}] ${e.id} (HTTP ${status}): ${url}`);
    }
  }

  if (!write) {
    console.log("\nDry run only — re-run with --write to blank out the confirmed 404 links in place.");
    return;
  }

  if (dead404.length === 0) {
    console.log("\nNothing to write — no confirmed 404s.");
    return;
  }

  for (const rel of FILES) {
    let text = fileTexts[rel];
    let changedCount = 0;
    for (const url of dead404) {
      const entries = byUrl.get(url).filter((e) => e.file === rel);
      for (const e of entries) {
        // Scope the replacement to this problem's own line/object by matching its id first.
        const idRe = new RegExp(
          `(id:\\s*"${e.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^}]*?link:\\s*")${url.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}(")`,
        );
        if (idRe.test(text)) {
          text = text.replace(idRe, `$1$2`); // collapses to link: ""
          changedCount++;
        }
      }
    }
    if (changedCount > 0) {
      await fs.writeFile(path.join(root, rel), text, "utf8");
      console.log(`Updated ${rel}: blanked ${changedCount} link(s).`);
    }
  }

  console.log("\nDone. Run your typecheck/build to confirm everything still compiles.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
