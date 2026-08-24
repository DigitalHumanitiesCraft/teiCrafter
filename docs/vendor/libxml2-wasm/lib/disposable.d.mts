import './disposeShim.mjs';
import './metadataShim.mjs';
/**
 * The base implementation of the interface Disposable is designed to manage wasm memory.
 *
 * Please remember to call the `dispose()` method for any subclass object.
 *
 * @template T The subclass that inherits from XmlDisposable.
 */
export declare abstract class XmlDisposable<T extends XmlDisposable<T>> implements Disposable {
    /**
     * Alias of {@link "[dispose]"}.
     *
     * @see {@link "[dispose]"}
     */
    dispose(): void;
    /**
     * Dispose the object.
     *
     * It releases the managed resource and unregisters it from FinalizationRegistry.
     * This ensures that the release of the managed resource doesn't have to wait until
     * the object is garbage collected.
     *
     * To avoid resource leaks,
     * explicitly call the `Dispose` method or use the `using` declaration to declare the object.
     *
     * @see {@link dispose}
     */
    [Symbol.dispose](): void;
}
