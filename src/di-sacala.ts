/**
 * Base interface for services in the DI system.
 * The `name` property is used as the key when the service is injected into a DiContainer.
 */
export interface DiService<Name extends string> {
    /**
     * The name of the service.
     * This is used as the key when the service is injected into a DiContainer.
     *
     * The method is called without an instance context, so it can be used as a static property.
     */
    getServiceName(this: null): Name;
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

type CheckReservedField<Name, T> = Name extends keyof DiContainer
    ? `Reserved field name: ${Name}`
    : T;

type Append<Container, Service extends DiService<string>> =
    Service extends DiService<infer Name>
        ? CheckReservedField<
              Name,
              Container extends { [Key in Name]: unknown }
                  ? `Duplicate service name: ${Name}`
                  : Container & Di<Service>
          >
        : never;

type Merge<DI1, DI2> = Exclude<keyof DI1, "inject" | "injectContainer"> &
    Exclude<keyof DI2, "inject" | "injectContainer"> extends never
    ? DI1 & DI2
    : `Containers have duplicated keys: ${(Exclude<
          keyof DI1,
          "inject" | "injectContainer"
      > &
          Exclude<keyof DI2, "inject" | "injectContainer">) &
          string}`;

let fail = (message: string): never => {
    throw Error(message);
};

/**
 * DiContainer manages service instantiation and dependency resolution.
 * It uses a fluent interface to chain service registrations, dynamically
 * extending its own type with each injected service.
 */
export class DiContainer {
    /**
     * Registers a new service by instantiating it with the current container instance.
     * The service is then attached to the container using its `name` property.
     */
    inject<S extends DiService<string>>(
        dependency: new (dependencies: this) => S,
    ): Append<this, S> {
        let prototype = dependency.prototype;
        let t = this;
        let name: string = (prototype as any).getServiceName.call();
        let instance: S | undefined;
        let getInstance = () =>
            instance ||= ((t as any)[name] = new (dependency as any)(t));

        if ((t as any)[name]) {
            fail((/^inject(Container)?$/.test(name) ? "Reserv" : "Duplicat") + "ed service name: " + name);
        }

        // create the service on first property access
        (t as any)[name] = new Proxy(
            Object.create(prototype),
            {
                get: (_, property) => {
                    let instance = getInstance();
                    let value = (instance as any)[property];
                    return typeof value == "function"
                        ? value.bind(instance)
                        : value;
                }
            },
        );

        return t as any;
    }

    /**
     * Copies all service properties from another container into this one.
     * Useful for composing containers or providing shared dependencies.
     *
     * @template DC - The type of the other DiContainer.
     * @param other - The source container to copy services from.
     * @returns The current container instance, typed with the merged services.
     * @throws {Error} If any service name from the other container already exists in this container.
     */
    injectContainer<DC extends DiContainer>(other: DC): Merge<this, DC> {
        for (let key in other) {
            if (key in this) {
                fail("Containers have duplicated keys: " + key);
            }
        }

        return Object.assign(this, other) as Merge<this, DC>;
    }
}
