/**
 * Base interface for services in the DI system.
 * The service name is used as the key when the service is injected into a DiContainer.
 */
export interface DiService<Name extends string> {
    /**
     * The name of the service, used as the key when it is injected into a DiContainer.
     * The method is called without an instance context, so it can be used as a static property.
     */
    getServiceName(this: null): Name;
}

/**
 * Converts services passed as separate type arguments into a merged object type.
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

type CheckReservedField<Name, T> =
    // `_` is the private service registry, invisible to `keyof`
    Name extends Extract<keyof DiContainer, string> | "_"
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

/**
 * `AsyncDisposable` if any of the services is, otherwise `Disposable` if any is.
 */
type Dispose<Service> = [Extract<Service, AsyncDisposable>] extends [never]
    ? [Extract<Service, Disposable>] extends [never]
        ? object
        : Disposable
    : AsyncDisposable;

/**
 * Wraps the services into a container, passing error messages through.
 */
type ToContainer<Services> = Services extends object
    ? DiContainer<Services>
    : Services;

interface Injector<Services> {
    /**
     * Register services.
     * Each service can depend on all others provided in the same call.
     */
    inject<S extends DiService<string>[]>(
        ...dependencies: {
            [K in keyof S]: new (
                dependencies: ToContainer<AppendAll<Services, S>>,
            ) => S[K];
        }
    ): ToContainer<AppendAll<Services, S>>;
}

/**
 * A container exposing the services by name. It is `AsyncDisposable` if any
 * service is, otherwise `Disposable` if any service is.
 */
// biome-ignore lint/complexity/noBannedTypes: `{}` is the empty services record
export type DiContainer<Services = {}> = Services &
    Dispose<Services[keyof Services]> &
    Injector<Services>;

const dispose: typeof Symbol.dispose = Symbol.dispose;
const asyncDispose: typeof Symbol.asyncDispose = Symbol.asyncDispose;

type Registered = Partial<
    Record<typeof dispose | typeof asyncDispose, () => unknown>
>;

/**
 * DiContainer manages service instantiation and dependency resolution.
 * Its fluent `inject` extends the container type with each registered service.
 */
export const DiContainer: new () => DiContainer = class DiContainer {
    /**
     * Registered services, in registration order, disposed in reverse.
     */
    private _: Registered[] = [];

    inject(...dependencies: (new (dependencies: any) => any)[]) {
        return dependencies.reduce((t: any, dependency) => {
            let prototype = dependency.prototype;
            let name: string = (0, prototype.getServiceName)();
            let instance: any;

            if (t[name]) {
                throw Error(
                    (name in DiContainer.prototype ? "Reserv" : "Duplicat") +
                        "ed service name: " +
                        name,
                );
            }

            // Registered for disposal when injected, so the order never depends on usage
            t._.push(
                (t[name] = new Proxy(Object.create(prototype), {
                    get: (_, property, value) => {
                        if (
                            (property === dispose ||
                                property === asyncDispose) &&
                            !instance
                        ) {
                            // Never instantiate a service just to dispose it
                            return () => undefined;
                        }
                        instance ||= t[name] = new dependency(t);
                        value = instance[property];
                        return (typeof value)[0] == "f"
                            ? value.bind(instance)
                            : value;
                    },
                })),
            );

            return t;
        }, this);
    }

    /**
     * Dispose the instantiated services in reverse registration order.
     */
    [dispose]() {
        let a: Registered | undefined;
        while ((a = this._.pop())) {
            a[dispose]?.();
        }
    }

    /**
     * Like `Symbol.dispose`, awaiting each service; `Symbol.asyncDispose` is preferred.
     */
    async [asyncDispose]() {
        let a: Registered | undefined;
        while ((a = this._.pop())) {
            await (a[asyncDispose] || a[dispose])?.();
        }
    }
};
