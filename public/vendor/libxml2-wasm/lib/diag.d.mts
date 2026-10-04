/**
 * The options for memory diagnostic.
 */
export interface DiagOptions {
    /**
     * Enables the memory diagnostics.
     * Note that the tracking information will be lost when it is disabled.
     */
    enabled: boolean;
    /**
     * Generates statistics of the callstack for {@link disposable.XmlDisposable}.
     */
    callerStats?: boolean;
    /**
     * Records the callstack of creating each {@link disposable.XmlDisposable}.
     */
    callerDetail?: boolean;
}
/**
 * Set up memory diagnostic helpers.
 *
 * When enabled,
 * these helpers will record allocated {@link disposable.XmlDisposable} objects
 * (and their subclass objects)
 * and track whether the {@link disposable.XmlDisposable#dispose} method is called.
 *
 * Note that the allocation of these objects will not be monitored
 * before memory diagnostics is enabled.
 *
 * @param options
 * @see {@link report}
 */
export declare function configure(options: DiagOptions): void;
/**
 * Obtain the report containing information about un-disposed objects.
 * @returns The report (in JSON format) whose format may vary according to the settings,
 * and is subject to change.
 * If memory diagnostic is not enabled, the report will be undefined.
 * @see {@link configure}
 */
export declare function report(): any;
