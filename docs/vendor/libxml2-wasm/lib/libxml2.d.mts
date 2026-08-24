import type { Pointer, XmlAttrPtr, XmlDocPtr, XmlDtdPtr, XmlErrorPtr, XmlNodePtr, XmlNsPtr, XmlOutputBufferPtr, XmlParserCtxtPtr, XmlSaveCtxtPtr, XmlXPathCompExprPtr, XmlXPathContextPtr } from './libxml2raw.mjs';
import { ContextStorage } from './utils.mjs';
/**
 * The base class for exceptions in this library.
 *
 * All exceptions thrown in this library will be instances of this class or its subclasses.
 */
export declare class XmlError extends Error {
}
export interface ErrorDetail {
    /**
     * The error message during processing.
     */
    message: string;
    /**
     * The name of the XML file in which the error occurred.
     */
    file?: string;
    /**
     * The line number in the xml file where the error occurred.
     */
    line: number;
    /**
     * The column number in the XML file where the error occurred.
     */
    col: number;
}
/**
 * An exception class represents the error in libxml2.
 */
export declare class XmlLibError extends XmlError {
    /**
     * The detail of errors provided by libxml2.
     */
    details: ErrorDetail[];
    constructor(message: string, details: ErrorDetail[]);
}
export declare function xmlReadString(ctxt: XmlParserCtxtPtr, xmlString: string, url: string | null, encoding: string | null, options: number): XmlDocPtr;
export declare function xmlReadMemory(ctxt: XmlParserCtxtPtr, xmlBuffer: Uint8Array, url: string | null, encoding: string | null, options: number): XmlDocPtr;
export declare function xmlXPathRegisterNs(ctx: XmlXPathContextPtr, prefix: string, uri: string): number;
export declare function xmlHasNsProp(node: XmlNodePtr, name: string, namespace: string | null): XmlAttrPtr;
export declare function xmlSetNsProp(node: XmlNodePtr, namespace: XmlNsPtr, name: string, value: string): XmlAttrPtr;
export declare function xmlNodeGetContent(node: XmlNodePtr): string;
export declare function xmlNodeSetContent(node: XmlNodePtr, content: string): number;
export declare function xmlGetNsList(doc: XmlDocPtr, node: XmlNodePtr): XmlNsPtr[];
export declare function xmlSearchNs(doc: XmlDocPtr, node: XmlNodePtr, prefix: string | null): XmlNsPtr;
export declare function xmlXPathCtxtCompile(ctxt: XmlXPathContextPtr, str: string): XmlXPathCompExprPtr;
export declare namespace error {
    const storage: ContextStorage<ErrorDetail[]>;
    const errorCollector: number;
}
export declare class XmlXPathObjectStruct {
    static type: (ptr: number) => number;
    static nodesetval: (ptr: number) => number;
    static boolval: (ptr: number) => number;
    static floatval: (ptr: number) => number;
    static stringval: (ptr: number) => string;
}
export declare namespace XmlXPathObjectStruct {
    enum Type {
        XPATH_NODESET = 1,
        XPATH_BOOLEAN = 2,
        XPATH_NUMBER = 3,
        XPATH_STRING = 4
    }
}
export declare class XmlNodeSetStruct {
    static nodeCount: (ptr: number) => number;
    static nodeTable(nodeSetPtr: Pointer, size: number): Int32Array<ArrayBufferLike>;
}
export declare class XmlTreeCommonStruct {
    static type: (ptr: number) => number;
    static name_: (ptr: number) => string;
    static children: (ptr: number) => number;
    static last: (ptr: number) => number;
    static parent: (ptr: number) => number;
    static next: (ptr: number) => number;
    static prev: (ptr: number) => number;
    static doc: (ptr: number) => number;
}
export declare class XmlNamedNodeStruct extends XmlTreeCommonStruct {
    static namespace: (ptr: number) => number;
}
export declare class XmlNodeStruct extends XmlNamedNodeStruct {
    static properties: (ptr: number) => number;
    static nsDef: (ptr: number) => number;
    static line: (ptr: number) => number;
}
export declare namespace XmlNodeStruct {
    enum Type {
        XML_ELEMENT_NODE = 1,
        XML_ATTRIBUTE_NODE = 2,
        XML_TEXT_NODE = 3,
        XML_CDATA_SECTION_NODE = 4,
        XML_ENTITY_REF_NODE = 5,
        XML_PI_NODE = 7,
        XML_COMMENT_NODE = 8,
        XML_DOCUMENT_NODE = 9,
        XML_DTD_NODE = 14,
        XML_ELEMENT_DECL = 15,
        XML_ATTRIBUTE_DECL = 16,
        XML_ENTITY_DECL = 17,
        XML_NAMESPACE_DECL = 18
    }
}
export declare class XmlNsStruct {
    static next: (ptr: number) => number;
    static href: (ptr: number) => string;
    static prefix: (ptr: number) => string;
}
export declare class XmlAttrStruct extends XmlTreeCommonStruct {
}
export declare class XmlErrorStruct {
    static message: (ptr: number) => string;
    static file: (ptr: number) => string | null;
    static line: (ptr: number) => number;
    static col: (ptr: number) => number;
}
export declare function xmlNewCDataBlock(doc: XmlDocPtr, content: string): XmlNodePtr;
export declare function xmlNewDocComment(doc: XmlDocPtr, content: string): XmlNodePtr;
export declare function xmlNewDocNode(doc: XmlDocPtr, ns: XmlNsPtr, name: string): XmlNodePtr;
export declare function xmlNewDocText(doc: XmlDocPtr, content: string): XmlNodePtr;
export declare function xmlNewNs(node: XmlNodePtr, href: string, prefix?: string): XmlNsPtr;
export declare function xmlNewReference(doc: XmlDocPtr, name: string): XmlNodePtr;
/**
 * The input provider for Virtual IO.
 *
 * This interface defines four callbacks for reading the content of XML files.
 * Each callback takes a 4-byte integer as the type of file descriptor.
 *
 * @see {@link xmlRegisterInputProvider}
 * @alpha
 */
export interface XmlInputProvider {
    /**
     * Determine if this input provider should handle this file.
     * @param filename The file name/path/url
     * @returns true if the provider should handle it.
     */
    match(filename: string): boolean;
    /**
     * Open the file and return a file descriptor (handle) representing the file.
     * @param filename The file name/path/url
     * @returns undefined on error, number on success.
     */
    open(filename: string): number | undefined;
    /**
     * Read from the file.
     * @param fd File descriptor
     * @param buf Buffer to read into, with a maximum read size of its byteLength.
     * @returns number of bytes actually read, -1 on error.
     */
    read(fd: Pointer, buf: Uint8Array): number;
    /**
     * Close the file.
     * @param fd File descriptor
     * @returns `true` if succeeded.
     */
    close(fd: Pointer): boolean;
}
/**
 * Register the callbacks from the provider to the system.
 *
 * @param provider Provider of callbacks to be registered.
 * @alpha
 */
export declare function xmlRegisterInputProvider(provider: XmlInputProvider): boolean;
/**
 * Remove and cleanup all registered input providers.
 * @alpha
 */
export declare function xmlCleanupInputProvider(): void;
/**
 * Options to be passed in the call to saving functions
 *
 * @default If not specified, `{ format: true }` will be used.
 * @see {@link XmlDocument#save}
 * @see {@link XmlDocument#toString}
 */
export interface SaveOptions {
    /**
     * Format output. This adds newlines and enables indenting
     * by default.
     * @default false
     */
    format?: boolean;
    /**
     * Don't emit an XML declaration.
     *
     * @default false
     */
    noDeclaration?: boolean;
    /**
     * Don't emit empty tags.
     *
     * @default false
     */
    noEmptyTags?: boolean;
    /**
     * The string used for indentation.
     *
     * @default Two spaces: "  "
     */
    indentString?: string;
    /**
     * The encoding to use for the output.
     *
     * @default The original encoding of the document or utf-8
     */
    encoding?: string;
}
export declare function xmlSaveOption(options?: SaveOptions): number;
/**
 * Callbacks to process the content in the output buffer.
 */
export interface XmlOutputBufferHandler {
    /**
     * The function that gets called when the content is consumed.
     * @param buf The buffer that holds the output data.
     *
     * @returns The bytes had been consumed or -1 on errors
     */
    write(buf: Uint8Array): number;
    /**
     * The callback function that will be triggered once all the data has been consumed.
     *
     * @returns Whether the operation is succeeded.
     */
    close(): boolean;
}
export declare function xmlSaveToIO(handler: XmlOutputBufferHandler, encoding: string | null, format: number): XmlSaveCtxtPtr;
export declare function xmlCtxtParseDtd(ctxt: XmlParserCtxtPtr, mem: Uint8Array, publicId: string | null, systemId: string | null): XmlDtdPtr;
export declare function xmlSaveSetIndentString(ctxt: XmlSaveCtxtPtr, indent: string): number;
/**
 * Helper to create a C-style NULL-terminated array of C strings.
 *
 * Allocates a single contiguous memory block containing:
 * - First: the pointer array (n+1 pointers, last is NULL)
 * - Then: the string data (all strings with null terminators)
 *
 * Memory layout: [ptr0][ptr1]...[ptrN][NULL][str0\0][str1\0]...[strN\0]
 *
 * @returns The pointer to the allocated memory. Caller must free with {@link free}.
 */
export declare function allocCStringArray(strings: string[]): Pointer;
export declare const free: (memblock: Pointer) => void;
export declare const xmlAddChild: (parent: XmlNodePtr, cur: XmlNodePtr) => XmlNodePtr;
export declare const xmlAddNextSibling: (prev: XmlNodePtr, cur: XmlNodePtr) => XmlNodePtr;
export declare const xmlAddPrevSibling: (next: XmlNodePtr, cur: XmlNodePtr) => XmlNodePtr;
export declare const xmlCtxtSetErrorHandler: (ctxt: XmlParserCtxtPtr, handler: import("./libxml2raw.mjs").XmlStructuredErrorFunc, data: Pointer) => void;
export declare const xmlCtxtValidateDtd: (ctxt: XmlParserCtxtPtr, doc: XmlDocPtr, dtd: XmlDtdPtr) => number;
export declare const xmlDocGetRootElement: (doc: XmlDocPtr) => XmlNodePtr;
export declare const xmlDocSetRootElement: (doc: XmlDocPtr, root: XmlNodePtr) => XmlNodePtr;
export declare const xmlFreeDoc: (Doc: XmlDocPtr) => void;
export declare const xmlFreeNode: (node: XmlNodePtr) => void;
export declare const xmlFreeDtd: (dtd: XmlDtdPtr) => void;
export declare const xmlFreeParserCtxt: (ctxt: XmlParserCtxtPtr) => void;
export declare const xmlGetIntSubset: (doc: XmlDocPtr) => XmlDtdPtr;
export declare const xmlGetLastError: () => XmlErrorPtr;
export declare const xmlNewDoc: () => XmlDocPtr;
export declare const xmlNewParserCtxt: () => XmlParserCtxtPtr;
export declare const xmlRelaxNGFree: (schema: import("./libxml2raw.mjs").XmlRelaxNGPtr) => void;
export declare const xmlRelaxNGFreeParserCtxt: (ctxt: import("./libxml2raw.mjs").XmlRelaxNGParserCtxtPtr) => void;
export declare const xmlRelaxNGFreeValidCtxt: (ctxt: import("./libxml2raw.mjs").XmlRelaxNGValidCtxtPtr) => void;
export declare const xmlRelaxNGNewDocParserCtxt: (doc: XmlDocPtr) => import("./libxml2raw.mjs").XmlRelaxNGParserCtxtPtr;
export declare const xmlRelaxNGNewValidCtxt: (schema: import("./libxml2raw.mjs").XmlRelaxNGPtr) => import("./libxml2raw.mjs").XmlRelaxNGValidCtxtPtr;
export declare const xmlRelaxNGParse: (ctxt: import("./libxml2raw.mjs").XmlRelaxNGParserCtxtPtr) => import("./libxml2raw.mjs").XmlRelaxNGPtr;
export declare const xmlRelaxNGSetParserStructuredErrors: (ctxt: import("./libxml2raw.mjs").XmlRelaxNGValidCtxtPtr, handler: import("./libxml2raw.mjs").XmlStructuredErrorFunc, data: Pointer) => void;
export declare const xmlRelaxNGSetValidStructuredErrors: (ctxt: import("./libxml2raw.mjs").XmlRelaxNGValidCtxtPtr, handler: import("./libxml2raw.mjs").XmlStructuredErrorFunc, data: Pointer) => void;
export declare const xmlRelaxNGValidateDoc: (ctxt: import("./libxml2raw.mjs").XmlRelaxNGValidCtxtPtr, doc: XmlDocPtr) => number;
export declare const xmlRemoveProp: (cur: XmlAttrPtr) => number;
export declare const xmlResetLastError: () => void;
export declare const xmlSaveClose: (ctxt: XmlSaveCtxtPtr) => void;
export declare const xmlSaveDoc: (ctxt: XmlSaveCtxtPtr, doc: XmlDocPtr) => number;
export declare const xmlSaveTree: (ctxt: XmlSaveCtxtPtr, node: XmlNodePtr) => number;
export declare const xmlSchemaFree: (schema: import("./libxml2raw.mjs").XmlSchemaPtr) => void;
export declare const xmlSchemaFreeParserCtxt: (ctx: import("./libxml2raw.mjs").XmlSchemaParserCtxtPtr) => void;
export declare const xmlSchemaFreeValidCtxt: (ctx: import("./libxml2raw.mjs").XmlSchemaValidCtxtPtr) => void;
export declare const xmlSchemaNewDocParserCtxt: (doc: XmlDocPtr) => import("./libxml2raw.mjs").XmlSchemaParserCtxtPtr;
export declare const xmlSchemaNewValidCtxt: (schema: import("./libxml2raw.mjs").XmlSchemaPtr) => import("./libxml2raw.mjs").XmlSchemaValidCtxtPtr;
export declare const xmlSchemaParse: (ctx: import("./libxml2raw.mjs").XmlSchemaParserCtxtPtr) => import("./libxml2raw.mjs").XmlSchemaPtr;
export declare const xmlSchemaSetParserStructuredErrors: (ctx: import("./libxml2raw.mjs").XmlSchemaParserCtxtPtr, handler: import("./libxml2raw.mjs").XmlStructuredErrorFunc, data: Pointer) => void;
export declare const xmlSchemaSetValidStructuredErrors: (ctx: import("./libxml2raw.mjs").XmlSchemaValidCtxtPtr, handler: import("./libxml2raw.mjs").XmlStructuredErrorFunc, data: Pointer) => void;
export declare const xmlSchemaValidateDoc: (ctx: import("./libxml2raw.mjs").XmlSchemaValidCtxtPtr, doc: XmlDocPtr) => number;
export declare const xmlSchemaValidateOneElement: (ctx: import("./libxml2raw.mjs").XmlSchemaValidCtxtPtr, elem: XmlNodePtr) => number;
export declare const xmlSetNs: (node: XmlNodePtr, ns: XmlNsPtr) => void;
export declare const xmlUnlinkNode: (cur: XmlNodePtr) => void;
export declare const xmlXIncludeFreeContext: (ctx: import("./libxml2raw.mjs").XmlXIncludeCtxtPtr) => void;
export declare const xmlXIncludeNewContext: (doc: XmlDocPtr) => import("./libxml2raw.mjs").XmlXIncludeCtxtPtr;
export declare const xmlXIncludeProcessNode: (ctxt: import("./libxml2raw.mjs").XmlXIncludeCtxtPtr, node: XmlNodePtr) => number;
export declare const xmlXIncludeSetErrorHandler: (ctxt: import("./libxml2raw.mjs").XmlXIncludeCtxtPtr, handler: import("./libxml2raw.mjs").XmlStructuredErrorFunc, data: Pointer) => void;
export declare const xmlXPathCompiledEval: (comp: XmlXPathCompExprPtr, ctx: XmlXPathContextPtr) => import("./libxml2raw.mjs").XmlXPathObjectPtr;
export declare const xmlXPathFreeCompExpr: (comp: XmlXPathCompExprPtr) => void;
export declare const xmlXPathFreeContext: (context: XmlXPathContextPtr) => void;
export declare const xmlXPathFreeObject: (obj: import("./libxml2raw.mjs").XmlXPathObjectPtr) => void;
export declare const xmlXPathNewContext: (doc: XmlDocPtr) => XmlXPathContextPtr;
export declare const xmlXPathSetContextNode: (node: XmlNodePtr, ctx: XmlXPathContextPtr) => number;
export declare const xmlOutputBufferClose: (out: XmlOutputBufferPtr) => number;
export declare const xmlC14NExecute: (doc: XmlDocPtr, is_visible_callback: Pointer, user_data: Pointer, mode: number, inclusive_ns_prefixes: Pointer, with_comments: number, buf: Pointer) => number;
