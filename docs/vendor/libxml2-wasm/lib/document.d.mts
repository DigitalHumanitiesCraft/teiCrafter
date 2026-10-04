import { SaveOptions, XmlLibError, XmlOutputBufferHandler } from './libxml2.mjs';
import { XmlElement, type XmlNode } from './nodes.mjs';
import { NamespaceMap, XmlXPath } from './xpath.mjs';
import { XmlDisposable } from './disposable.mjs';
import { XmlDtd } from './dtd.mjs';
import { type C14NOptions } from './c14n.mjs';
export declare enum ParseOption {
    XML_PARSE_DEFAULT = 0,
    /**
     * Enable "recovery" mode which allows non-wellformed documents.
     * How this mode behaves exactly is unspecified and may change without further notice.
     * Use of this feature is DISCOURAGED.
     *
     * Not supported by the push parser.
     */
    XML_PARSE_RECOVER = 1,
    /**
     * Despite the confusing name, this option enables substitution of entities.
     * The resulting tree won't contain any entity reference nodes.
     *
     * This option also enables loading of external entities (both general and parameter entities)
     * which is dangerous. If you process untrusted data, it's recommended to set the
     * XML_PARSE_NO_XXE option to disable loading of external entities.
     */
    XML_PARSE_NOENT = 2,
    /**
     * Enables loading of an external DTD and the loading and substitution of external
     * parameter entities. Has no effect if XML_PARSE_NO_XXE is set.
     */
    XML_PARSE_DTDLOAD = 4,
    /**
     * Adds default attributes from the DTD to the result document.
     *
     * Implies XML_PARSE_DTDLOAD, but loading of external content
     * can be disabled with XML_PARSE_NO_XXE.
     */
    XML_PARSE_DTDATTR = 8,
    /**
     * Enable DTD validation which requires loading external DTDs and external entities
     * (both general and parameter entities) unless XML_PARSE_NO_XXE was set.
     *
     * DTD validation is vulnerable to algorithmic complexity attacks and should never be
     * enabled with untrusted input.
     */
    XML_PARSE_DTDVALID = 16,
    /**
     * Disable error and warning reports to the error handlers.
     * Errors are still accessible with xmlCtxtGetLastError().
     */
    XML_PARSE_NOERROR = 32,
    /** Disable warning reports. */
    XML_PARSE_NOWARNING = 64,
    /** Enable some pedantic warnings. */
    XML_PARSE_PEDANTIC = 128,
    /**
     * Remove some whitespace from the result document. Where to remove whitespace depends on
     * DTD element declarations or a broken heuristic with unfixable bugs. Use of this option is
     * DISCOURAGED.
     *
     * Not supported by the push parser.
     */
    XML_PARSE_NOBLANKS = 256,
    /**
     * Always invoke the deprecated SAX1 startElement and endElement handlers.
     *
     * @deprecated This option will be removed in a future version.
     */
    XML_PARSE_SAX1 = 512,
    /**
     * Enable XInclude processing. This option only affects the xmlTextReader
     * and XInclude interfaces.
     */
    XML_PARSE_XINCLUDE = 1024,
    /**
     * Disable network access with the built-in HTTP or FTP clients.
     * After the last built-in network client was removed in 2.15, this option has no effect
     * except for being passed on to custom resource loaders.
     */
    XML_PARSE_NONET = 2048,
    /**
     * Create a document without interned strings, making all strings separate memory allocations.
     */
    XML_PARSE_NODICT = 4096,
    /** Remove redundant namespace declarations from the result document. */
    XML_PARSE_NSCLEAN = 8192,
    /** Output normal text nodes instead of CDATA nodes. */
    XML_PARSE_NOCDATA = 16384,
    /**
     * Don't generate XInclude start/end nodes when expanding inclusions.
     * This option only affects the xmlTextReader and XInclude interfaces.
     */
    XML_PARSE_NOXINCNODE = 32768,
    /**
     * Store small strings directly in the node struct to save memory.
     */
    XML_PARSE_COMPACT = 65536,
    /**
     * Use old Name productions from before XML 1.0 Fifth Edition.
     *
     * @deprecated This option will be removed in a future version.
     */
    XML_PARSE_OLD10 = 131072,
    /**
     * Don't fix up XInclude xml:base URIs. This option only affects the xmlTextReader
     * and XInclude interfaces.
     */
    XML_PARSE_NOBASEFIX = 262144,
    /**
     * Relax some internal limits.
     *
     * Maximum size of text nodes, tags, comments, processing instructions,
     * CDATA sections, entity values
     *
     *  - normal: 10M
     *  - huge:    1B
     *
     * Maximum size of names, system literals, pubid literals
     *
     *  - normal: 50K
     *  - huge:   10M
     *
     * Maximum nesting depth of elements
     *
     *  - normal:  256
     *  - huge:   2048
     *
     * Maximum nesting depth of entities
     *
     *  - normal: 20
     *  - huge:   40
     */
    XML_PARSE_HUGE = 524288,
    /**
     * Enable an unspecified legacy mode for SAX parsers.
     *
     * @deprecated This option will be removed in a future version.
     */
    XML_PARSE_OLDSAX = 1048576,
    /**
     * Ignore the encoding in the XML declaration. Mostly unneeded these days.
     * The only effect is to enforce UTF-8 decoding of ASCII-like data.
     */
    XML_PARSE_IGNORE_ENC = 2097152,
    /** Enable reporting of line numbers larger than 65535. */
    XML_PARSE_BIG_LINES = 4194304,
    /**
     * Disable loading of external DTDs or entities.
     */
    XML_PARSE_NO_XXE = 8388608,
    /**
     * Enable input decompression. Setting this option is discouraged to avoid zip bombs.
     */
    XML_PARSE_UNZIP = 16777216,
    /**
     * Disable the global system XML catalog.
     */
    XML_PARSE_NO_SYS_CATALOG = 33554432,
    /**
     * Enable XML catalog processing instructions.
     */
    XML_PARSE_CATALOG_PI = 67108864,
    /**
     * Force the parser to ignore IDs.
     */
    XML_PARSE_SKIP_IDS = 134217728
}
export interface ParseOptions {
    /**
     * The URL of the document.
     *
     * It can be used as a base to calculate the URL of other included documents.
     */
    url?: string;
    encoding?: string;
    option?: ParseOption;
}
export declare class XmlParseError extends XmlLibError {
}
/**
 * The XML document.
 */
export declare class XmlDocument extends XmlDisposable<XmlDocument> {
    /** Create a new document from scratch.
     * To parse an existing xml, use {@link fromBuffer} or {@link fromString}.
     */
    static create(): XmlDocument;
    /**
     * Parse and create an {@link XmlDocument} from an XML string.
     *
     * Note: Only UTF-8 encoding is supported for string input.
     * For other encodings, use {@link fromBuffer} instead.
     *
     * @param source The XML string
     * @param options Parsing options
     * @throws Error when encoding is not 'utf-8'
     */
    static fromString(source: string, options?: ParseOptions): XmlDocument;
    /**
     * Parse and create an {@link XmlDocument} from an XML buffer.
     * @param source The XML buffer
     * @param options Parsing options
     */
    static fromBuffer(source: Uint8Array, options?: ParseOptions): XmlDocument;
    /**
     * Save the XmlDocument to a string
     *
     * By default, it outputs utf-8 encoded bytes,
     * while `ascii` is another allowed option for `options.encoding`,
     * which converts non-ascii characters into numeric character references.
     *
     * @param options options to adjust the saving behavior
     * @see {@link save}
     * @see {@link XmlElement#toString}
     */
    toString(options?: SaveOptions): string;
    /**
     * Save the XmlDocument to a buffer and invoke the callbacks to process.
     *
     * @deprecated Use `save` instead.
     */
    toBuffer(handler: XmlOutputBufferHandler, options?: SaveOptions): void;
    /**
     * Save the XmlDocument to a buffer and invoke the callbacks to process.
     *
     * By default, it outputs with original encoding.
     *
     * @param handler handlers to process the content in the buffer
     * @param options options to adjust the saving behavior
     * @see {@link toString}
     * @see {@link XmlElement#save}
     */
    save(handler: XmlOutputBufferHandler, options?: SaveOptions): void;
    /**
     * Find the first descendant node of root element matching the given compiled xpath selector.
     * @param xpath XPath selector
     * @returns null if not found, otherwise an instance of the subclass of {@link XmlNode}.
     * @see
     *  - {@link XmlNode#get | XmlNode.get}
     *  - {@link XmlXPath.compile | XmlXPath.compile}
     *  - {@link find}
     *  - {@link eval}
     */
    get(xpath: XmlXPath): XmlNode | null;
    /**
     * Find the first descendant node of root element matching the given xpath selector.
     * @param xpath XPath selector
     * @param namespaces mapping between prefix and the namespace URI, used in the XPath
     * @returns null if not found, otherwise an instance of the subclass of {@link XmlNode}.
     * @see
     *  - {@link XmlNode#get | XmlNode.get}
     *  - {@link find}
     *  - {@link eval}
     */
    get(xpath: string, namespaces?: NamespaceMap): XmlNode | null;
    /**
     * Find all the descendant nodes of root element matching the given compiled xpath selector.
     * @param xpath Compiled XPath selector
     * @returns An empty array if no nodes are found.
     * @see
     *  - {@link XmlNode#find | XmlNode.find}
     *  - {@link get}
     *  - {@link eval}
     */
    find(xpath: XmlXPath): XmlNode[];
    /**
     * Find all the descendant nodes of root element matching the given xpath selector.
     * @param xpath XPath selector
     * @param namespaces mapping between prefix and the namespace URI, used in the XPath
     * @returns An empty array if no nodes are found.
     * @see
     *  - {@link XmlNode#find | XmlNode.find}
     *  - {@link get}
     *  - {@link eval}
     */
    find(xpath: string, namespaces?: NamespaceMap): XmlNode[];
    /**
     * Evaluate the given XPath selector on the root element.
     * @param xpath XPath selector
     * @see
     *  - {@link XmlNode#get | XmlNode.get}
     *  - {@link XmlXPath.compile | XmlXPath.compile}
     *  - {@link get}
     *  - {@link find}
     */
    eval(xpath: XmlXPath): XmlNode[] | string | boolean | number;
    /**
     * Evaluate the given XPath selector on the root element.
     * @param xpath XPath selector
     * @see
     *  - {@link XmlNode#get | XmlNode.get}
     *  - {@link get}
     *  - {@link find}
     */
    eval(xpath: string, namespaces?: NamespaceMap): XmlNode[] | string | boolean | number;
    /**
     * Get the DTD of the document.
     * @returns The DTD of the document, or null if the document has no DTD.
     */
    get dtd(): XmlDtd | null;
    /**
     * The root element of the document.
     * If the document is newly created and hasn’t been set up with a root,
     * an {@link XmlError} will be thrown.
     */
    get root(): XmlElement;
    /**
     * Set the root element of the document.
     * @param value The new root.
     * If the node is from another document,
     * it and its subtree will be removed from the previous document.
     */
    set root(value: XmlElement);
    /**
     * Create the root element.
     * @param name The name of the root element.
     * @param namespace The namespace of the root element.
     * @param prefix The prefix of the root node that represents the given namespace.
     * If not provided, the given namespace will be the default.
     */
    createRoot(name: string, namespace?: string, prefix?: string): XmlElement;
    /**
     * Process the XInclude directives in the document synchronously.
     *
     * @returns the number of XInclude nodes processed.
     */
    processXInclude(): number;
    /**
     * Canonicalize the document and invoke the handler to process.
     *
     * @param handler handlers to process the content in the buffer
     * @param options options to adjust the canonicalization behavior
     * @see {@link canonicalizeToString}
     */
    canonicalize(handler: XmlOutputBufferHandler, options?: C14NOptions): void;
    /**
     * Canonicalize the document to a string.
     *
     * @param options options to adjust the canonicalization behavior
     * @returns The canonicalized XML string
     * @see {@link canonicalize}
     */
    canonicalizeToString(options?: C14NOptions): string;
}
