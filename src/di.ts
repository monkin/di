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
 * A type transformation that converts one or more Services (passed as separate
 * arguments) into a merged mapped object type.
 *
 * Example: Di<LoggerService> -> { logger: LoggerService }
 * Example: Di<ServiceA, ServiceB> -> { a: ServiceA } & { b: ServiceB }
 */
export type Di<
    S1,
    S2 = never,
    S3 = never,
    S4 = never,
    S5 = never,
    S6 = never,
    S7 = never,
    S8 = never,
    S9 = never,
    S10 = never,
    S11 = never,
    S12 = never,
    S13 = never,
    S14 = never,
    S15 = never,
    S16 = never,
> = ToDi<S1> &
    ToDi<S2> &
    ToDi<S3> &
    ToDi<S4> &
    ToDi<S5> &
    ToDi<S6> &
    ToDi<S7> &
    ToDi<S8> &
    ToDi<S9> &
    ToDi<S10> &
    ToDi<S11> &
    ToDi<S12> &
    ToDi<S13> &
    ToDi<S14> &
    ToDi<S15> &
    ToDi<S16>;

type ToDi<S> = [S] extends [never]
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
                    (name in DiContainer.prototype ? "Reserv" : "Duplicat") +
                        "ed service name: " +
                        name,
                );
            }

            (t as any)[name] = new Proxy(Object.create(prototype), {
                get: (_, property, value) => {
                    instance ||= (t as any)[name] = new (dependency as any)(t);
                    value = (instance as any)[property];
                    return (typeof value)[0] == "f"
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
            if ((this as any)[key]) {
                throw Error("Containers have duplicated keys: " + key);
            }
        }

        return Object.assign(this, other) as Merge<this, DC>;
    }
}
