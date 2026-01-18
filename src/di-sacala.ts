/**
 * Base interface for services in the DI system.
 * The `name` property is used as the key when the service is injected into a DiContainer.
 */
export interface DiService<Name extends string> {
    name: Name;
}

/**
 * A recursive type transformation that converts a Service (or tuple of Services)
 * into a mapped object type.
 *
 * Example: Service<"logger"> -> { logger: Service<"logger"> }
 * Example: [Service<"a">, Service<"b">] -> { a: Service<"a"> } & { b: Service<"b"> }
 */
export type Di<S> = S extends [infer S1, ...infer Tail]
    ? Di<S1> & Di<Tail>
    : S extends []
      ? unknown
      : S extends DiService<infer Name>
        ? { [Key in Name]: S }
        : never;

/**
 * DiContainer manages service instantiation and dependency resolution.
 * It uses a fluent interface to chain service registrations, dynamically
 * extending its own type with each injected service.
 */
export class DiContainer {
    constructor() {}

    /**
     * Registers a new service by instantiating it with the current container instance.
     * The service is then attached to the container using its `name` property.
     *
     * @template S - The type of service being injected.
     * @param dependency - A constructor for the service, which receives the container as its only argument.
     * @returns The container instance, typed with the newly added service.
     */
    inject<S extends DiService<string>>(
        dependency: new (dependencies: this) => S,
    ): this & Di<S> {
        let instance: S | undefined;

        Object.defineProperty(this, dependency.name, {
            enumerable: true,
            configurable: false,
            writable: false,
            // Create the instance on first access
            get: () => instance ?? (instance = new dependency(this)),
        });

        return this as any;
    }

    /**
     * Copies all service properties from another container into this one.
     * Useful for composing containers or providing shared dependencies.
     *
     * @template DC - The type of the other DiContainer.
     * @param other - The source container to copy services from.
     * @returns The current container instance, typed with the merged services.
     */
    injectContainer<DC extends DiContainer>(other: DC): this & DC {
        for (const key in other) {
            if (Object.prototype.hasOwnProperty.call(other, key)) {
                Object.defineProperty(this, key, {
                    enumerable: true,
                    configurable: false,
                    writable: false,
                    // Create the instance on first access
                    get: () => other[key],
                });
            }
        }
        return this as any;
    }
}
