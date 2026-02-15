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

type Append<
    Container,
    Service extends DiService<string>,
> = Container extends object
    ? Service extends DiService<infer Name>
        ? CheckReservedField<
              Name,
              Container extends { [Key in Name]: unknown }
                  ? `Duplicate service name: ${Name}`
                  : Container & Di<Service>
          >
        : never
    : Container;

/**
 * A recursive type transformation that appends multiple services to a container.
 */
export type AppendAll<
    Container,
    Services extends any[],
> = Container extends object
    ? Services extends [infer Head, ...infer Tail]
        ? Head extends DiService<string>
            ? AppendAll<Append<Container, Head>, Tail>
            : AppendAll<Container, Tail>
        : Container
    : Container;

type Merge<DI1, DI2> = DI1 extends object
    ? DI2 extends object
        ? Exclude<keyof DI1, keyof DiContainer> &
              Exclude<keyof DI2, keyof DiContainer> extends never
            ? DI1 & DI2
            : `Containers have duplicated keys: ${(Exclude<
                  keyof DI1,
                  keyof DiContainer
              > &
                  Exclude<keyof DI2, keyof DiContainer>) &
                  string}`
        : DI2
    : DI1;

/**
 * DiContainer manages service instantiation and dependency resolution.
 * It uses a fluent interface to chain service registrations, dynamically
 * extending its own type with each injected service.
 */
export class DiContainer {
    /**
     * Register services.
     * Each service can depend on all others provided in the same call.
     */
    inject<S extends DiService<string>[]>(
        ...dependencies: {
            [K in keyof S]: new (
                dependencies: AppendAll<this, S>,
            ) => S[K];
        }
    ): AppendAll<this, S> {
        return dependencies.reduce((t, dependency) => {
            let prototype = dependency.prototype;
            let name: string = (0, (prototype as any).getServiceName)();
            let instance: S | undefined;

            if ((t as any)[name]) {
                throw Error(
                    (/^inject(Container|All)?$/.test(name)
                        ? "Reserv"
                        : "Duplicat") +
                        "ed service name: " +
                        name,
                );
            }

            (t as any)[name] = new Proxy(Object.create(prototype), {
                get: (_, property) => {
                    instance ||= (t as any)[name] = new (dependency as any)(t);
                    let value = (instance as any)[property];
                    return typeof value == "function"
                        ? value.bind(instance)
                        : value;
                },
            });

            return t as any;
        }, this) as any;
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
                throw Error("Containers have duplicated keys: " + key);
            }
        }

        return Object.assign(this, other) as Merge<this, DC>;
    }
}
