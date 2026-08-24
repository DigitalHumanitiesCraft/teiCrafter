import { XmlError } from './libxml2.mjs';
import { XmlDisposable } from './disposable.mjs';
/**
 * An exception class for XPath compilation errors.
 */
export declare class XmlXPathError extends XmlError {
}
/**
 * Map between the prefix and the URI of the namespace
 */
export interface NamespaceMap {
    [prefix: string]: string;
}
/**
 * The XPath object.
 *
 * At the time of creation, this object compiles the XPath expression,
 * which can be reused multiple times, even for different documents.
 *
 * Note: This object requires to be {@link dispose}d explicitly.
 */
export declare class XmlXPath extends XmlDisposable<XmlXPath> {
    private readonly _xpathSource;
    private readonly _namespaces;
    /**
     * Namespaces and prefixes used in the XPath.
     */
    get namespaces(): NamespaceMap | undefined;
    /**
     * XPath selector string.
     */
    toString(): string;
    /**
     * Create a new XPath object.
     * @param xpathStr The XPath selector string.
     * @param namespaces Namespace map for prefixes used in the `xpathStr`.
     */
    static compile(xpathStr: string, namespaces?: NamespaceMap): XmlXPath;
}
