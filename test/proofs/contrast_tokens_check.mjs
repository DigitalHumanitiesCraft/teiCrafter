/**
 * Proof: the colour tokens that set text or focus indicators meet WCAG contrast.
 *   - muted, confidence and review text reach 4.5:1 on surface, panel,
 *     secondary, sunken surface and their own tints (1.4.3);
 *   - the dark values of the opt-in scheme keep muted text at 4.5:1;
 *   - the focus token reaches 3:1 on surface and panel (1.4.11), and no editor
 *     stylesheet draws a 2px focus outline in the brand gold;
 *   - the source-first tokens in src/ui/tokens.css carry the same values.
 *
 * Run: node test/proofs/contrast_tokens_check.mjs   (exit 0 = all pass)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, finish, section } from "./_assert.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const styles = read("docs/css/style.css");

function tokens(css) {
  const light = {};
  const dark = {};
  for (const match of css.matchAll(/(--color-[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) light[match[1]] ??= match[2];
  for (const match of css.matchAll(/(--color-[\w-]+):\s*light-dark\((#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\)/g)) dark[match[1]] = match[3];
  return { light, dark: { ...light, ...dark } };
}

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const { light, dark } = tokens(styles);
const backgrounds = ["--color-surface", "--color-panel", "--color-secondary", "--color-surface-sunken"];

section("Text tokens, light scheme (4.5:1)");
for (const [fg, tint] of [
  ["--color-text-muted", null],
  ["--color-confident", "--color-confident-tint"],
  ["--color-review", "--color-review-tint"],
]) {
  for (const bg of tint ? [...backgrounds, tint] : backgrounds) {
    const value = ratio(light[fg], light[bg]);
    check(`${fg} on ${bg}: ${value.toFixed(2)}`, value >= 4.5);
  }
}

section("Muted text, dark scheme (4.5:1)");
for (const bg of ["--color-surface", "--color-panel", "--color-secondary"]) {
  const value = ratio(dark["--color-text-muted"], dark[bg]);
  check(`--color-text-muted on dark ${bg}: ${value.toFixed(2)}`, value >= 4.5);
}

section("Focus indicator (3:1)");
check("--color-focus is defined", Boolean(light["--color-focus"]));
for (const bg of ["--color-surface", "--color-panel"]) {
  const value = ratio(light["--color-focus"] || "#FFFFFF", light[bg]);
  check(`--color-focus on ${bg}: ${value.toFixed(2)}`, value >= 3);
}
for (const sheet of ["docs/css/editor.css", "docs/css/entry-workspace.css", "docs/css/editorial-forms.css"]) {
  check(`${sheet} draws no 2px gold outline`, !/outline:\s*2px solid var\(--color-gold\)/.test(read(sheet)));
}

section("Source-first tokens match");
const src = tokens(read("src/ui/tokens.css")).light;
for (const name of ["--color-text-muted", "--color-confident", "--color-review"]) {
  check(`${name} equal in docs and src`, src[name]?.toUpperCase() === light[name]?.toUpperCase());
}

finish("contrast_tokens_check: all checks passed.");
