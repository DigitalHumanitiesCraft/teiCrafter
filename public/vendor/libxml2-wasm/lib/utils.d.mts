import { XmlInputProvider, XmlOutputBufferHandler } from './libxml2.mjs';
import { Pointer } from './libxml2raw.mjs';
/**
 * Manage JS context object for wasm.
 *
 * In libxml2, a registration of callback often has a context/userdata pointer.
 * But when it is in wasm, this pointer is essentially an integer.
 *
 * To support JS object as context/userdata, we store it in the map and access with an integer key.
 * This key could be passed to the registration.
 * And the callback use this key to retrieve the real object.
 */
export declare class ContextStorage<T> {
    private storage;
    private index;
    allocate(value: T): number;
    free(index: number): void;
    get(index: number): T;
}
/**
 * A XmlInputProvider implementation that reads from buffers.
 *
 * This can be passed to {@link xmlRegisterInputProvider} to read XML content from memory.
 */
export declare class XmlBufferInputProvider implements XmlInputProvider {
    private _data;
    /**
     * Create a new XmlBufferInputProvider with a set of buffers.
     * @param data The buffers by their filename.
     */
    constructor(data: Record<string, Uint8Array>);
    /**
     * Add a buffer to the provider.
     * @param filename The filename of the buffer.
     * @param buffer The buffer to add.
     */
    addBuffer(filename: string, buffer: Uint8Array): void;
    /**
     * Remove a buffer from the provider.
     * @param filename The filename of the buffer to remove.
     */
    removeBuffer(filename: string): void;
    match(filename: string): boolean;
    open(filename: string): number;
    read(fd: number, buffer: Uint8Array): number;
    close(fd: Pointer): boolean;
}
/**
 * Open a buffer for reading.
 * @param buffer The buffer to read from.
 * @returns The file descriptor for the buffer reader.
 */
export declare function openBuffer(buffer: Uint8Array): number;
/**
 * Read from the buffer.
 * @param fd The file descriptor for the buffer reader.
 * @param buffer The buffer to read into.
 * @returns The number of bytes read.
 */
export declare function readBuffer(fd: number, buffer: Uint8Array): number;
/**
 * Close the buffer reader.
 * @param fd The file descriptor for the buffer reader.
 */
export declare function closeBuffer(fd: Pointer): void;
export declare class XmlStringOutputBufferHandler implements XmlOutputBufferHandler {
    private _result;
    private _decoder;
    write(buf: Uint8Array): number;
    close(): boolean;
    get result(): string;
}
