import { SaveOptions, XmlInputProvider } from './libxml2.mjs';
import { XmlDocument } from './document.mjs';
/**
 * The virtual IO input providers for file operations in Node.js,
 * utilizing the `node:fs` module.
 *
 * These providers support both file paths (e.g., `path/to/file.xml`)
 * and file URLs (e.g., `file:///path/to/file.xml`).
 *
 * @see {@link libxml2-wasm!xmlRegisterInputProvider}
 */
export declare const fsInputProviders: XmlInputProvider;
/**
 * Register {@link fsInputProviders}.
 *
 * @see {@link libxml2-wasm!xmlRegisterInputProvider}
 */
export declare function xmlRegisterFsInputProviders(): boolean;
/**
 * Synchronously save the {@link XmlDocument} to a file.
 * @param doc The XmlDocument to be saved.
 * @param fd The file descriptor returned by `fs.open` or `fs.openSync`, etc.
 * @param options Options for saving.
 */
export declare function saveDocSync(doc: XmlDocument, fd: number, options?: SaveOptions): void;
