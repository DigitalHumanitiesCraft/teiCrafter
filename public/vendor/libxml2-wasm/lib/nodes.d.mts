import { XmlDocument } from './document.mjs';
import { SaveOptions, XmlOutputBufferHandler } from './libxml2.mjs';
import { NamespaceMap, XmlXPath } from './xpath.mjs';
import { SubtreeC14NOptions } from './c14n.mjs';
/**
 * The base class for all types of XML nodes.
 */
export declare abstract class XmlNode {
    /**
     * The {@link XmlDocument} containing this node.
     */
    get doc(): XmlDocument;
    /**
     * Remove the node from its parent.
     */
    remove(): void;
    /**
     * The parent node of this node.
     *
     * For root node, its parent is null.
     */
    get parent(): XmlElement | null;
    /**
     * The content string of the node.
     */
    get content(): string;
    /**
     * The line number of the node if the node is parsed from an XML document.
     */
    get line(): number;
    /**
     * Canonicalize this node and its subtree to a buffer and invoke the handler to process.
     *
     * @param handler handlers to process the content in the buffer
     * @param options options to adjust the canonicalization behavior
     * @see {@link canonicalizeToString}
     */
    canonicalize(handler: XmlOutputBufferHandler, options?: SubtreeC14NOptions): void;
    /**
     * Canonicalize this node and its subtree and return the result as a string.
     *
     * @param options options to adjust the canonicalization behavior
     * @returns The canonicalized XML string.
     * @see {@link canonicalize}
     */
    canonicalizeToString(options?: SubtreeC14NOptions): string;
    /**
     * Find the first descendant node matching the given compiled xpath selector
     *
     * @param xpath XPath selector
     * @returns null if not found, otherwise an instance of the subclass of {@link XmlNode}.
     * @see
     * - {@link find}
     * - {@link eval}
     * - {@link XmlXPath.compile | XmlXPath.compile}
     */
    get(xpath: XmlXPath): XmlNode | null;
    /**
     * Find the first descendant node matching the given xpath selector
     *
     * @param xpath XPath selector
     * @param namespaces mapping between prefix and the namespace URI, used in the XPath
     * @returns null if not found, otherwise an instance of the subclass of {@link XmlNode}.
     * @see
     * - {@link find}
     * - {@link eval}
     */
    get(xpath: string, namespaces?: NamespaceMap): XmlNode | null;
    /**
     * Find all the descendant nodes matching the given compiled xpath selector.
     * @param xpath XPath selector
     * @returns An empty array if no nodes are found.
     * @see
     *  - {@link get}
     *  - {@link eval}
     *  - {@link XmlXPath.compile | XmlXPath.compile}
     */
    find(xpath: XmlXPath): XmlNode[];
    /**
     * Find all the descendant nodes matching the given xpath selector.
     * @param xpath XPath selector
     * @param namespaces mapping between prefix and the namespace URI, used in the XPath
     * @returns An empty array if no nodes are found.
     * @see
     *  - {@link get}
     *  - {@link eval}
     */
    find(xpath: string, namespaces?: NamespaceMap): XmlNode[];
    /**
     * Evaluate the given XPath selector on this node.
     * @param xpath XPath selector
     * @see
     *  - {@link get}
     *  - {@link find}
     *  - {@link XmlXPath.compile | XmlXPath.compile}
     */
    eval(xpath: XmlXPath): XmlNode[] | string | boolean | number;
    /**
     * Evaluate the given XPath selector on this node.
     * @param xpath XPath selector
     * @see
     *  - {@link get}
     *  - {@link find}
     */
    eval(xpath: string, namespaces?: NamespaceMap): XmlNode[] | string | boolean | number;
}
/**
 *
 */
export declare class XmlDocumentNode extends XmlNode {
}
export declare class XmlDocumentTypeNode extends XmlNode {
}
export declare class XmlElementDeclNode extends XmlNode {
}
export declare class XmlAttributeDeclNode extends XmlNode {
}
export declare class XmlEntityDeclNode extends XmlNode {
}
export declare class XmlNamespaceDeclNode extends XmlNode {
}
export declare class XmlProcessingInstructionNode extends XmlNode {
}
/**
 * The base class representing a node that can have siblings.
 */
export declare abstract class XmlTreeNode extends XmlNode {
    /**
     * Add a comment sibling node after this node.
     *
     * @param content the content of the comment
     *
     * @see {@link prependComment}
     * @see {@link XmlElement#addComment}
     */
    appendComment(content: string): XmlComment;
    /**
     * Insert a comment sibling node before this node.
     * @param content the content of the comment
     *
     * @see {@link appendComment}
     * @see {@link XmlElement#addComment}
     */
    prependComment(content: string): XmlComment;
    /**
     * Add a CDATA section sibling node after this node.
     * @param content the content of the CDATA section
     *
     * @see {@link prependCData}
     * @see {@link XmlElement#addCData}
     */
    appendCData(content: string): XmlCData;
    /**
     * Insert a CDATA section sibling node before this node.
     * @param content the content of the CDATA section
     *
     * @see {@link appendCData}
     * @see {@link XmlElement#addCData}
     */
    prependCData(content: string): XmlCData;
    /**
     * Add an element sibling node after this node.
     * @param name the element name
     * @param prefix the prefix of the element for the namespace
     *
     * @see {@link prependElement}
     * @see {@link XmlElement#addElement}
     */
    appendElement(name: string, prefix?: string): XmlElement;
    /**
     * Insert an element sibling node before this node.
     * @param name the element name
     * @param prefix the prefix of the element for the namespace
     *
     * @see {@link appendElement}
     * @see {@link XmlElement#addElement}
     */
    prependElement(name: string, prefix?: string): XmlElement;
    /**
     * Add a text sibling node after this node.
     * @param text the content of the text node
     *
     * @see {@link prependText}
     * @see {@link XmlElement#addText}
     */
    appendText(text: string): XmlText;
    /**
     * Insert a text sibling node before this node.
     * @param text the content of the text node
     *
     * @see {@link appendText}
     * @see {@link XmlElement#addText}
     */
    prependText(text: string): XmlText;
    /**
     * Add an entity reference sibling node after this node.
     * @param name the name of the entity reference
     * @see {@link prependEntityReference}
     * @see {@link XmlElement#addEntityReference}
     */
    appendEntityReference(name: string): XmlEntityReference;
    /**
     * Insert an entity reference sibling node before this node.
     * @param name the name of the entity reference
     * @see {@link appendEntityReference}
     * @see {@link XmlElement#addEntityReference}
     */
    prependEntityReference(name: string): XmlEntityReference;
    /**
     * The node that represents the next sibling.
     *
     * @return null if this node is the last one.
     *
     * @see
     *  - {@link XmlElement#firstChild}
     *  - {@link XmlElement#lastChild}
     *  - {@link prev}
     */
    get next(): XmlTreeNode | null;
    /**
     * The node that represents the previous sibling.
     *
     * @return null if this node is the first one.
     *
     * @see
     *  - {@link XmlElement#firstChild}
     *  - {@link XmlElement#lastChild}
     *  - {@link next}
     */
    get prev(): XmlTreeNode | null;
}
/**
 * The interface for the XML nodes that have names and namespaces.
 */
export interface XmlNamedNode {
    /**
     * The name of this node.
     */
    get name(): string;
    /**
     * The URI of the namespace applied to this node.
     */
    get namespaceUri(): string;
    /**
     * The prefix representing the namespace applied to this node.
     */
    get prefix(): string;
    /**
     * Alias of {@link prefix}
     */
    get namespacePrefix(): string;
    /**
     * Set the namespace prefix of this node.
     * @param prefix The new prefix to set.
     * Use empty string to remove the prefix.
     */
    set prefix(prefix: string);
    set namespacePrefix(prefix: string);
    /**
     * Effective namespace declarations on this node, including inherited.
     */
    get namespaces(): NamespaceMap;
    /**
     * Find out corresponding namespace URI for a prefix
     * @param prefix
     */
    namespaceForPrefix(prefix: string): string | null;
}
export interface XmlElement extends XmlNamedNode {
}
/**
 * The class representing an XML element node.
 */
export declare class XmlElement extends XmlTreeNode {
    /**
     * The node representing the first child of an element.
     *
     * Note that the children of an element do not include attributes.
     *
     * @return null if this node has no child.
     *
     * @see
     *  - {@link lastChild}
     *  - {@link next}
     *  - {@link prev}
     */
    get firstChild(): XmlTreeNode | null;
    /**
     * The node representing the last child of an element.
     *
     * Note that the children of an element do not include attributes.
     *
     * Return null if this node has no child
     *
     * @see
     *  - {@link firstChild}
     *  - {@link next}
     *  - {@link prev}
     */
    get lastChild(): XmlTreeNode | null;
    /**
     * All attributes of this element.
     */
    get attrs(): XmlAttribute[];
    /**
     * Namespace declarations on this element
     *
     * @returns Empty object if there's no local namespace definition on this element.
     * Note that the default namespace uses empty string as the key in the returned object.
     */
    get nsDeclarations(): NamespaceMap;
    /**
     * @deprecated use {@link nsDeclarations} instead.
     */
    get localNamespaces(): NamespaceMap;
    /**
     * Add a namespace declaration to this element.
     * @param uri The namespace URI.
     * @param prefix The prefix that the namespace to be used as.
     * If not provided, it will be treated as the default namespace.
     *
     * @throws XmlError if namespace declaration already exists.
     */
    addNsDeclaration(uri: string, prefix?: string): void;
    /**
     * @deprecated use {@link addNsDeclaration} instead.
     */
    addLocalNamespace(uri: string, prefix?: string): void;
    /**
     * Get the attribute of this element.
     * @param name The name of the attribute
     * @param prefix The namespace prefix to the attribute.
     * @return null if the attribute doesn't exist.
     */
    attr(name: string, prefix?: string): XmlAttribute | null;
    /**
     * Set the attribute of this element.
     * @param name The name of the attribute
     * @param value The value of the attribute
     * @param prefix The namespace prefix to the attribute.
     */
    setAttr(name: string, value: string, prefix?: string): XmlAttribute;
    /**
     * Add a child comment node to the end of the children list.
     * @param content the content of the comment
     *
     * @see {@link appendComment}
     * @see {@link prependComment}
     */
    addComment(content: string): XmlComment;
    /**
     * Add a child CDATA section node to the end of the children list.
     * @param content the content of the CDATA section
     *
     * @see {@link appendCData}
     * @see {@link prependCData}
     */
    addCData(content: string): XmlCData;
    /**
     * Add a new element to the end of the children list.
     * @param name the element name
     * @param prefix the prefix of the element for the namespace
     *
     * @see {@link appendElement}
     * @see {@link prependElement}
     */
    addElement(name: string, prefix?: string): XmlElement;
    /**
     * Add a child text node to the end of the children list.
     * Note that this method will merge the text node if the last child is also a text node.
     * @param text the content of the text node
     *
     * @see {@link appendText}
     * @see {@link prependText}
     */
    addText(text: string): XmlText;
    /**
     * Add a child entity reference node to the end of the children list.
     * @param name the name of the entity reference
     * @see {@link prependEntityReference}
     * @see {@link appendEntityReference}
     */
    addEntityReference(name: string): XmlEntityReference;
    /**
     * Save the XmlElement to a buffer and invoke the callbacks to process.
     *
     * By default, it outputs utf-8 encoded bytes. Use `options.encoding` to change it.
     *
     * @param handler handlers to process the content in the buffer
     * @param options options to adjust the saving behavior
     * @see {@link toString}
     * @see {@link XmlDocument#save}
     */
    save(handler: XmlOutputBufferHandler, options?: SaveOptions): void;
    /**
     * Save the XmlElement to a string
     *
     * By default, it outputs utf-8 encoded bytes,
     * while `ascii` is another allowed option for `options.encoding`,
     * which converts non-ascii characters into numeric character references.
     *
     * @param options options to adjust the saving behavior
     * @see {@link save}
     * @see {@link XmlDocument#toString}
     */
    toString(options?: SaveOptions): string;
}
export interface XmlAttribute extends XmlNamedNode {
}
/**
 * The class representing an XML attribute node.
 */
export declare class XmlAttribute extends XmlNode {
    /**
     * Remove current attribute from the element and document.
     */
    remove(): void;
    /**
     * The value of this attribute.
     */
    get value(): string;
    /**
     * Set the value of this attribute.
     */
    set value(value: string);
    /**
     * Alias of {@link value}.
     */
    get content(): string;
    set content(value: string);
}
/**
 * A simple node that contains only text content without children.
 */
export declare abstract class XmlSimpleNode extends XmlTreeNode {
    get content(): string;
    /**
     * Set the content of the node.
     * @param value the new content
     */
    set content(value: string);
}
export declare class XmlCData extends XmlSimpleNode {
}
export declare class XmlComment extends XmlSimpleNode {
}
export declare class XmlText extends XmlSimpleNode {
}
export declare class XmlEntityReference extends XmlTreeNode {
    /**
     * The name of the entity this node references.
     */
    get name(): string;
}
