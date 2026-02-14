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

const ReservedFields = new Set(["inject", "injectContainer"] as const);

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

const has = (obj: object, key: string | number | symbol): boolean =>
    Object.prototype.hasOwnProperty.call(obj, key);

const eachOwn = <T extends object>(obj: T, callback: (key: keyof T) => void) =>
    Object.keys(obj).forEach(callback as (key: string) => void);

const fail = (message: string): never => {
    throw new Error(message);
};

/**
 * DiContainer manages service instantiation and dependency resolution.
 * It uses a fluent interface to chain service registrations, dynamically
 * extending its own type with each injected service.
 */
export class DiContainer {
    constructor() {}

    inject<S extends DiService<string>>(
        dependency: new (dependencies: this) => S,
    ): Append<this, S>;
    inject<Name extends string, S>(
        name: Name,
        create: (dependencies: this) => S,
    ): Append<this, S & DiService<Name>>;

    /**
     * Registers a new service by instantiating it with the current container instance.
     * The service is then attached to the container using its `name` property.
     */
    inject<S>(
        ...parameters:
            | [dependency: new (dependencies: this) => S]
            | [name: string, create: (dependencies: this) => S]
    ): any {
        const name: string =
            parameters.length === 1
                ? parameters[0].prototype.getServiceName.call(null)
                : parameters[0];

        let instance: S | undefined;

        const getInstance = () => {
            if (!instance) {
                instance =
                    parameters.length === 1
                        ? new parameters[0](this)
                        : parameters[1](this);
            }
            return instance;
        };

        // create the service on first property access
        const lazy = new Proxy(
            {},
            {
                get: (_, property) => {
                    const instance = getInstance();
                    const value = (instance as any)[property];
                    return value instanceof Function
                        ? value.bind(instance)
                        : value;
                },
                getPrototypeOf(): object | null {
                    return Object.getPrototypeOf(getInstance());
                },
                has(_target: object, p: string | symbol): boolean {
                    return has(getInstance() as object, p);
                },
                ownKeys(): ArrayLike<string | symbol> {
                    return Object.getOwnPropertyNames(getInstance() as object);
                },
            },
        );

        if (ReservedFields.has(name as any)) {
            fail(`Reserved field name: ${name}`);
        }

        if (has(this, name)) {
            fail(`Duplicate service name: ${name}`);
        }

        (this as any)[name] = lazy;

        return this as any;
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
        eachOwn(other, (key) => {
            if (has(this, key)) {
                fail(`Containers have duplicated keys: ${String(key)}`);
            }
        });

        eachOwn(other, (key) => {
            Object.defineProperty(this, key, {
                enumerable: true,
                get: () => (other as any)[key],
            });
        });
        return this as any;
    }
}
