import { XmlOutputBufferHandler } from './libxml2.mjs';
import { type XmlNode } from './nodes.mjs';
import type { XmlDocument } from './document.mjs';
/**
 * C14N (Canonical XML) modes supported by libxml2
 * @see http://www.w3.org/TR/xml-c14n
 * @see http://www.w3.org/TR/xml-exc-c14n
 */
export declare const XmlC14NMode: {
    /** Original C14N 1.0 specification */
    readonly XML_C14N_1_0: 0;
    /** Exclusive C14N 1.0 (omits unused namespace declarations) */
    readonly XML_C14N_EXCLUSIVE_1_0: 1;
    /** C14N 1.1 specification */
    readonly XML_C14N_1_1: 2;
};
/**
 * Callback to determine if a node should be included in canonicalization.
 *
 * @param node The node being evaluated
 * @param parent The parent of the node being evaluated
 * @returns true if the node should be included, false otherwise
 */
export type XmlC14NIsVisibleCallback = (node: XmlNode, parent: XmlNode | null) => boolean;
/**
 * Options for XML canonicalization
 */
export interface C14NOptions {
    /** The canonicalization mode to use
     * @default XmlC14NMode.XML_C14N_1_0
     */
    mode?: typeof XmlC14NMode[keyof typeof XmlC14NMode];
    /** Whether to include comments in the canonicalized output
     * @default false
     */
    withComments?: boolean;
    /** List of inclusive namespace prefixes for exclusive canonicalization
     * Only applies when mode is XML_C14N_EXCLUSIVE_1_0
     */
    inclusiveNamespacePrefixes?: string[];
    /** Custom callback to determine node visibility
     * Must not be used together with {@link nodeSet}
     */
    isVisible?: XmlC14NIsVisibleCallback;
    /** Set of nodes to include in canonicalization
     * Must not be used together with {@link isVisible}
     */
    nodeSet?: Set<XmlNode>;
}
/**
 * C14N options without filtering callbacks (for subtree canonicalization)
 */
export type SubtreeC14NOptions = Omit<C14NOptions, 'isVisible' | 'nodeSet'>;
/**
 * Canonicalize an entire XML document to a buffer and invoke callbacks to process.
 *

 * @param handler Callback to receive the canonicalized output
 * @param doc The XML document to canonicalize
 * @param options Canonicalization options
 *
 * @example
 * ```typescript
 * const handler = new XmlStringOutputBufferHandler();
 * canonicalizeDocument(handler, doc, {
 *   mode: XmlC14NMode.XML_C14N_1_0,
 *   withComments: false
 * });
 * ```
 */
export declare function canonicalizeDocument(handler: XmlOutputBufferHandler, doc: XmlDocument, options?: C14NOptions): void;
/**
 * Canonicalize a subtree of an XML document to a buffer and invoke callbacks to process.
 *
 * This is a convenience helper that creates an isVisible callback to filter
 * only nodes within the specified subtree.
 *
 * @param handler Callback to receive the canonicalized output
 * @param doc The document containing the subtree
 * @param subtreeRoot The root node of the subtree to canonicalize
 * @param options Canonicalization options (cannot include isVisible or nodeSet)
 *
 * @example
 * ```typescript
 * const element = doc.get('//my-element');
 * const handler = new XmlStringOutputBufferHandler();
 * canonicalizeSubtree(handler, doc, element!, {
 *   mode: XmlC14NMode.XML_C14N_EXCLUSIVE_1_0,
 *   inclusiveNamespacePrefixes: ['ns1', 'ns2'],
 *   withComments: false
 * });
 * ```
 */
export declare function canonicalizeSubtree(handler: XmlOutputBufferHandler, doc: XmlDocument, subtreeRoot: XmlNode, options?: SubtreeC14NOptions): void;
