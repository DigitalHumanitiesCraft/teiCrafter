import { XmlDocument } from './document.mjs';
import { XmlElement } from './nodes.mjs';
import { ErrorDetail, XmlLibError } from './libxml2.mjs';
import { XmlDisposable } from './disposable.mjs';
import { XmlDtd } from './dtd.mjs';
/**
 * The exception that is thrown when validating XML against a schema.
 */
export declare class XmlValidateError extends XmlLibError {
    static fromDetails(details: ErrorDetail[]): XmlValidateError;
}
/**
 * The DTD validator.
 *
 * Note: This validator needs to be disposed explicitly if the DTD is not owned by a document.
 *
 * @see {@link XmlDtd}
 * @see {@link "[dispose]"}
 */
export declare class DtdValidator {
    private readonly _dtd;
    constructor(dtd: XmlDtd);
    /**
     * Validate the XmlDocument.
     *
     * @param doc The XmlDocument to be validated.
     * @throws an {@link XmlValidateError} if the document is invalid.
     */
    validate(doc: XmlDocument): void;
    /**
     * Alias of {@link "[dispose]"}.
     *
     * @see {@link "[dispose]"}
     */
    dispose(): void;
    /**
     * Dispose the {@link XmlDtd} object.
     *
       To avoid resource leaks,
       explicitly call the `Dispose` method or use the `using` declaration to declare the object.
     *
     * @see {@link dispose}
     */
    [Symbol.dispose](): void;
}
/**
 * The RelaxNG schema validator.
 *
 * Note: This validator must be disposed explicitly.
 *
 * @deprecated libxml2 is planing to remove this: https://gitlab.gnome.org/GNOME/libxml2/-/releases/v2.14.0#planned-removals
 */
export declare class RelaxNGValidator extends XmlDisposable<RelaxNGValidator> {
    /**
     * Validate the XmlDocument.
     *
     * @param doc The XmlDocument to be validated.
     * @throws an {@link XmlValidateError} if the document is invalid;
     * @throws an {@link XmlError} or {@link XmlValidateError} if there’s an error,
     * such as validating a document that’s already disposed, etc.
     */
    validate(doc: XmlDocument): void;
    /**
     * Creates a RelaxNGValidator instance from an XmlDocument.
     * @param rng The XmlDocument representing the RelaxNG schema
     * @throws an {@link XmlError} or {@link XmlValidateError} if something goes wrong.
     */
    static fromDoc(rng: XmlDocument): RelaxNGValidator;
}
/**
 * The XSD schema validator.
 *
 * Note: This validator needs to be disposed explicitly.
 */
export declare class XsdValidator extends XmlDisposable<XsdValidator> {
    /**
     * Validate the XmlDocument.
     *
     * @param doc The XmlDocument to be validated.
     * @throws an {@link XmlValidateError} if the document is invalid;
     * @throws an {@link XmlError} or {@link XmlValidateError} if there's an error,
     * such as validating a document that's already disposed, etc.
     */
    validate(doc: XmlDocument): void;
    /**
     * Validate a subtree of the document.
     * @param elem The top most element of the subtree to be validated.
     * @throws an {@link XmlValidateError} if the document is invalid;
     * @throws an {@link XmlError} or {@link XmlValidateError} if there's an error,
     * such as validating a document that's already disposed, etc.
     */
    validate(elem: XmlElement): void;
    /**
     * Create an XsdValidator instance from an {@link XmlDocument} object.
     *
     * @param xsd The XSD schema, parsed in to an XmlDocument object.
     * @throws an {@link XmlError} or {@link XmlValidateError} if something goes wrong.
     */
    static fromDoc(xsd: XmlDocument): XsdValidator;
}
