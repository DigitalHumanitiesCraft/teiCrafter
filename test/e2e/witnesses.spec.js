import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { COLD_SCHEMA_OUTPUT_TIMEOUT_MS as COLD_SCHEMA_OUTPUT_TIMEOUT, SCHEMA_WORKFLOW_TIMEOUT_MS as COLD_SCHEMA_SCENARIO_TIMEOUT } from "./helpers/schema-output-timing.js";

const witnesses = '<listWit><witness xml:id="A">Alpha</witness><witness xml:id="B">Beta <hi>manuscript</hi></witness></listWit>';
const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Synthetic witness edition</title></titleStmt><publicationStmt><p>Original synthetic test.</p></publicationStmt><sourceDesc><p>Fictional source.${witnesses}</p></sourceDesc></fileDesc></teiHeader><text><body><p>Before <app xml:id="variation"><lem wit="#A">base</lem><rdgGrp><rdg wit="#B">variant</rdg></rdgGrp></app> <app xml:id="omission"><lem wit="#A">present</lem><rdg wit="#B"/></app> <app xml:id="ambiguity"><lem wit="#A">certain</lem><rdg wit="#B">first</rdg><rdg wit="#B">second</rdg></app> <app xml:id="missing"><lem wit="#A">unattributed</lem></app> after.</p></body></text></TEI>`;

async function open(page, source = raw) {
  await page.addInitScript(() => { Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true }); });
  await page.goto('/editor.html');
  await page.locator('#btn-load').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#menu-open').click();
  await (await chooser).setFiles({ name: 'witnesses.xml', mimeType: 'application/xml', buffer: Buffer.from(source) });
  await expect(page.locator('#ed-docstrip')).toContainText('witnesses.xml');
  await page.getByRole('tab', { name: 'Witnesses', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Reading witness', exact: true })).toBeVisible();
}
async function workingCopy(page) {
  const event = page.waitForEvent('download');
  await page.locator('#btn-working-copy').click();
  return JSON.parse(readFileSync(await (await event).path(), 'utf8')).record;
}
async function download(page) {
  const event = page.waitForEvent('download', { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT });
  await page.locator('#btn-download').click();
  return readFileSync(await (await event).path(), 'utf8');
}

test('witness projection discloses unresolved readings and witness CRUD preserves validated XML', async ({ page }) => {
  test.setTimeout(COLD_SCHEMA_SCENARIO_TIMEOUT);
  await open(page);
  const projection = page.getByRole('combobox', { name: 'Reading witness', exact: true });
  await projection.selectOption('B');
  const displayed = page.locator('#ed-reading .ed-w');
  await expect(displayed).toHaveText(['Before ', 'variant', ' after.']);
  await expect(page.locator('.ed-witness-status')).toContainText('Explicit empty reading');
  await expect(page.locator('.ed-witness-status')).toContainText('2 readings are attributed');
  await expect(page.locator('.ed-witness-status')).toContainText('No reading is explicitly attributed');
  expect((await workingCopy(page)).raw).toBe(raw);
  await projection.selectOption('');
  await expect(page.locator('#ed-reading')).toContainText('base');
  await page.getByRole('button', { name: 'New witness', exact: true }).click();
  await page.getByRole('textbox', { name: 'Witness identifier', exact: true }).fill('C');
  await page.getByRole('textbox', { name: 'Witness description', exact: true }).fill('Gamma & fourth');
  await page.getByRole('button', { name: 'Apply witness', exact: true }).click();
  const expected = raw.replace('</listWit>', '<witness xml:id="C">Gamma &amp; fourth</witness></listWit>');
  expect(await download(page)).toBe(expected);
  await page.getByRole('button', { name: 'Remove witness', exact: true }).click();
  expect((await workingCopy(page)).raw).toBe(raw);
  await page.locator('#btn-undo').click();
  expect((await workingCopy(page)).raw).toBe(expected);
  await page.getByRole('combobox', { name: 'Witness record', exact: true }).selectOption({ label: 'A: Alpha' });
  await page.getByRole('button', { name: 'Remove witness', exact: true }).click();
  await expect(page.locator('.ed-wb-feedback')).toContainText('referenced');
  expect((await workingCopy(page)).raw).toBe(expected);
  await page.locator('#btn-read-only').click();
  await expect(page.getByRole('button', { name: 'New witness', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Apply witness', exact: true })).toBeDisabled();
  await projection.selectOption('B');
  await expect(displayed).toHaveText(['Before ', 'variant', ' after.']);
  expect((await workingCopy(page)).raw).toBe(expected);
});

test('witness forms recover staged XML and reject malformed or reference-breaking edits', async ({ page }) => {
  const source = raw.replace(witnesses, '').replace('<text>', `<text><front><div>${witnesses}</div></front>`);
  await open(page, source);
  await page.getByRole('combobox', { name: 'Witness record', exact: true }).selectOption({ label: 'B: Beta manuscript' });
  await expect(page.getByRole('textbox', { name: 'Witness description', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Edit witness XML', exact: true }).click();
  const xml = page.getByRole('textbox', { name: 'Witness XML', exact: true });
  const replacement = '<witness xml:id="B">Beta <hi rend="italic">revised manuscript</hi></witness>';
  await xml.fill(replacement);
  await page.getByRole('combobox', { name: 'Reading witness', exact: true }).selectOption('B');
  await expect(page.getByRole('combobox', { name: 'Reading witness', exact: true })).toHaveValue('');
  const pending = await workingCopy(page);
  expect(pending.raw).toBe(source);
  expect(pending.staged.mode).toBe('witness');
  expect(pending.staged.value.fields.xml).toBe(replacement);
  await page.reload();
  await page.getByRole('button', { name: /Restore/ }).first().click();
  await expect(xml).toHaveValue(replacement);
  await xml.fill('<witness xml:id="B"><hi>Broken</witness>');
  await page.getByRole('button', { name: 'Apply witness', exact: true }).click();
  await expect(page.locator('.ed-wb-feedback')).not.toBeEmpty();
  expect((await workingCopy(page)).raw).toBe(source);
  await xml.fill(replacement.replace('xml:id="B"', 'xml:id="changed"'));
  await page.getByRole('button', { name: 'Apply witness', exact: true }).click();
  await expect(page.locator('.ed-wb-feedback')).toContainText('referenced');
  expect((await workingCopy(page)).raw).toBe(source);
  await xml.fill(replacement);
  await page.getByRole('button', { name: 'Apply witness', exact: true }).click();
  expect((await workingCopy(page)).raw).toBe(source.replace('<witness xml:id="B">Beta <hi>manuscript</hi></witness>', replacement));
  await page.locator('#btn-undo').click();
  expect((await workingCopy(page)).raw).toBe(source);
});

test('reading attribution preserves staged witness choices and changes only the explicit pointer list', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Edit witness attribution', exact: true }).click();
  const attribution = page.getByRole('listbox', { name: 'Reading witnesses', exact: true });
  await attribution.selectOption(['#A', '#B']);
  const pending = await workingCopy(page);
  expect(pending.raw).toBe(raw);
  expect(pending.staged.value.fields.wit).toBe('#A #B');
  await page.reload();
  await page.getByRole('button', { name: /Restore/ }).first().click();
  await expect(attribution).toHaveValues(['#A', '#B']);
  await page.getByRole('button', { name: 'Apply attribution', exact: true }).click();
  expect((await workingCopy(page)).raw).toBe(raw.replace('<lem wit="#A">base', '<lem wit="#A #B">base'));
  await page.getByRole('combobox', { name: 'Reading witness', exact: true }).selectOption('B');
  await expect(page.locator('.ed-witness-result')).toContainText('2 readings are attributed');
  await page.locator('#btn-undo').click();
  expect((await workingCopy(page)).raw).toBe(raw);
  await expect(page.locator('.ed-witness-result')).toContainText('One explicitly attributed reading');
});
