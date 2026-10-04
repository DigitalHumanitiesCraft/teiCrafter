import { XmlDisposable } from './disposable.mjs';
import { XmlDocument } from './document.mjs';
/**
 * Represents a Document Type Definition (DTD) in XML.
 *
 * If the DTD is not owned by a document, {@link XmlDtd#dispose} needs to be called to free the DTD.
 */
export declare class XmlDtd extends XmlDisposable<XmlDtd> {
    /**
     * The owner document of this DTD.
     *
     * If the DTD is not owned by a document, this will be `null`.
     */
    get doc(): XmlDocument | null;
    /**
     * Parse a DTD from a buffer.
     */
    static fromBuffer(buffer: Uint8Array): XmlDtd;
    /**
     * Parse a DTD from a string.
     */
    static fromString(str: string): XmlDtd;
}
