/**
 * Copies WASM runtime assets from node_modules into public/ so the app can be
 * served fully offline (no CDN requests at runtime):
 *   - @ffmpeg/core-mt  -> public/vendor/ffmpeg/  (audio extraction + export)
 *   - onnxruntime-web  -> public/vendor/ort/     (transformers.js inference)
 *   - Parakeet's ORT   -> public/vendor/ort-parakeet/ (Parakeet inference)
 * Runs automatically on `npm install` (postinstall).
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ffmpegSrc = join(root, "node_modules/@ffmpeg/core-mt/dist/esm");
const ffmpegDst = join(root, "public/vendor/ffmpeg");
mkdirSync(ffmpegDst, { recursive: true });
for (const f of readdirSync(ffmpegSrc)) {
  cpSync(join(ffmpegSrc, f), join(ffmpegDst, f));
}

// The @ffmpeg/ffmpeg "class worker" contains a dynamic import() that bundlers
// cannot process; serve the package's own ESM build and point classWorkerURL
// at it instead (see lib/ffmpeg.ts).
const ffmpegClassSrc = join(root, "node_modules/@ffmpeg/ffmpeg/dist/esm");
const ffmpegClassDst = join(root, "public/vendor/ffmpeg-class");
mkdirSync(ffmpegClassDst, { recursive: true });
for (const f of readdirSync(ffmpegClassSrc)) {
  if (f.endsWith(".js") || f.endsWith(".mjs")) {
    cpSync(join(ffmpegClassSrc, f), join(ffmpegClassDst, f));
  }
}

const ortSrc = join(root, "node_modules/onnxruntime-web/dist");
const ortDst = join(root, "public/vendor/ort");
mkdirSync(ortDst, { recursive: true });
for (const f of readdirSync(ortSrc)) {
  if (/^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(f)) {
    cpSync(join(ortSrc, f), join(ortDst, f));
  }
}

const parakeetOrtSrc = join(
  root,
  "node_modules/parakeet.js/node_modules/onnxruntime-web/dist"
);
const parakeetOrtDst = join(root, "public/vendor/ort-parakeet");
mkdirSync(parakeetOrtDst, { recursive: true });
for (const f of readdirSync(parakeetOrtSrc)) {
  if (/^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(f)) {
    cpSync(join(parakeetOrtSrc, f), join(parakeetOrtDst, f));
  }
}

// parakeet.js 1.4.4 accepts `wasmPaths` but does not apply it before falling
// back to a CDN. Keep the tiny vendor correction in postinstall so the app
// always uses the bundled 1.24.1 runtime above, including offline.
const parakeetBackend = join(root, "node_modules/parakeet.js/src/backend.js");
const parakeetBackendSource = readFileSync(parakeetBackend, "utf8");
const unpatchedWasmPathCheck = "if (!ort.env.wasm.wasmPaths) {";
const patchedWasmPathCheck =
  "if (wasmPaths) {\n" +
  "    ort.env.wasm.wasmPaths = wasmPaths;\n" +
  "  } else if (!ort.env.wasm.wasmPaths) {";
if (parakeetBackendSource.includes(unpatchedWasmPathCheck)) {
  writeFileSync(
    parakeetBackend,
    parakeetBackendSource.replace(unpatchedWasmPathCheck, patchedWasmPathCheck)
  );
} else if (!parakeetBackendSource.includes("if (wasmPaths) {")) {
  throw new Error("Could not apply the Parakeet local-WASM compatibility patch.");
}

// coi-serviceworker provides COOP/COEP headers on static hosts (GitHub Pages)
// that can't send them, keeping cross-origin isolation for SharedArrayBuffer.
// A config prelude is prepended: always use COEP "credentialless" (needed for
// Google Analytics) and skip registration when real headers already isolated
// the page (local dev / self-hosting with a proper server).
const coiSrc = join(root, "node_modules/coi-serviceworker/coi-serviceworker.js");
const coiPrelude =
  'if (typeof window !== "undefined") {\n' +
  "  window.coi = {\n" +
  "    coepCredentialless: () => true,\n" +
  "    shouldRegister: () => !window.crossOriginIsolated,\n" +
  "  };\n" +
  "}\n";
writeFileSync(
  join(root, "public/coi-serviceworker.js"),
  coiPrelude + readFileSync(coiSrc, "utf8")
);

console.log("[copy-assets] ffmpeg core + onnxruntime wasm + Parakeet runtime + coi-serviceworker copied to public/");
