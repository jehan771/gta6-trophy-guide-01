// Leonida Ledger — entrypoint for the GTA VI trophy guide bounty.
//
// What this script does, in plain terms:
//   1. works out where it lives on disk and where the finished bundle goes,
//   2. mirrors the finished guide app and its screenshots into that folder,
//   3. asks the make.fun frontend helper to assemble dossier.json there.
//
// Everything below is plain Node.js — no third-party packages involved.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

// Folder that holds this very file; the app/ and screenshots/ folders sit
// next to it, so every path below is anchored here instead of the cwd.
const repoRoot = path.dirname(fileURLToPath(import.meta.url));

// The harness tells us where the bundle belongs. When it says nothing we
// fall back to the conventional /output location.
const bundleDir =
  process.env.MAKEFUN_OUTPUT_DIR !== undefined &&
  process.env.MAKEFUN_OUTPUT_DIR !== ""
    ? process.env.MAKEFUN_OUTPUT_DIR
    : "/output";

// Mirror one directory tree onto another, creating parents as needed.
function mirrorTree(sourceDir: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

async function assembleBundle(): Promise<void> {
  // Make sure the destination exists before anything lands inside it.
  fs.mkdirSync(bundleDir, { recursive: true });

  // Ship the guide app itself.
  mirrorTree(path.join(repoRoot, "app"), path.join(bundleDir, "app"));

  // Ship the screenshots. The folder is created even when the repo has no
  // shots yet, so the bundle layout stays predictable either way.
  const shotsOut = path.join(bundleDir, "screenshots");
  fs.mkdirSync(shotsOut, { recursive: true });
  const shotsIn = path.join(repoRoot, "screenshots");
  if (fs.existsSync(shotsIn)) {
    fs.cpSync(shotsIn, shotsOut, { recursive: true });
  }

  // Let the frontend helper grade and describe the bundle, then persist
  // whatever it hands back as the dossier.
  const dossier = await buildDossier(bundleDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  });
  // The helper hands back raw dossier bytes (a Uint8Array). Those go to
  // disk untouched; anything else is serialised to JSON text first.
  const dossierPath = path.join(bundleDir, "dossier.json");
  if (typeof dossier === "string") {
    fs.writeFileSync(dossierPath, dossier);
  } else if (dossier instanceof Uint8Array) {
    fs.writeFileSync(dossierPath, dossier);
  } else {
    fs.writeFileSync(dossierPath, JSON.stringify(dossier, null, 2));
  }

  // Sanity-check the bundle before declaring success. A dossier that is
  // empty or unparsable, or an app that never landed, must fail loudly
  // here instead of shipping a broken entry.
  const writtenBack = fs.readFileSync(dossierPath, "utf8");
  if (writtenBack.trim().length === 0) {
    throw new Error(`dossier.json at ${dossierPath} came out empty`);
  }
  JSON.parse(writtenBack);
  const landedIndex = path.join(bundleDir, "app", "index.html");
  if (!fs.existsSync(landedIndex)) {
    throw new Error(`app/index.html is missing from the bundle: ${landedIndex}`);
  }
}

await assembleBundle();
