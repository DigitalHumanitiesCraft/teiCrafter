/**
 * Offline stand-in for a model, so the proposal flow can be demonstrated
 * without a provider or a key. It answers one prepared request taken from
 * public/samples/zbz-hersch-synthetic.xml: the generic <name> pointing to
 * pers_vautier, whose listPerson entry makes persName the specific element.
 * The answer goes through the same parser and fragment check as a real one.
 */
import type { CompleteOptions, CompletionProvider } from "./provider";

export const FIXTURE_SAMPLE = "samples/zbz-hersch-synthetic.xml";
/** The exact selection the fixture answers for; the shell locates it with raw.indexOf. */
export const FIXTURE_SELECTION = '<name ref="#pers_vautier">Marguerite Vautier</name>';
export const FIXTURE_INSTRUCTION = "Encode this person reference with the specific TEI element.";

const FIXTURE_ANSWER = [
  "BEGIN REPLACEMENT",
  '<persName ref="#pers_vautier">Marguerite Vautier</persName>',
  "END REPLACEMENT",
  "BEGIN RATIONALE",
  'The reference "#pers_vautier" points to a person in listPerson, so persName is the specific element for this name.',
  "END RATIONALE",
].join("\n");

export function createFixtureProvider(): CompletionProvider {
  return {
    id: "fixture",
    async complete(prompt: string, options: CompleteOptions = {}): Promise<string> {
      options.signal?.throwIfAborted();
      // The fixture answers one selection only; anything else would be an invented proposal.
      if (!prompt.includes(`\nSELECTED XML:\n${FIXTURE_SELECTION}\n`)) {
        throw new Error(`The offline fixture only answers for ${FIXTURE_SELECTION} in ${FIXTURE_SAMPLE}.`);
      }
      return FIXTURE_ANSWER;
    },
  };
}
