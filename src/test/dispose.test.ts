import { describe, expect, it } from "vitest";
import { type Di, DiContainer, type DiService } from "../di";

describe("Dispose", () => {
    it("should dispose instantiated services", () => {
        let disposed = 0;

        class DisposableService implements DiService<"disposable"> {
            getServiceName() {
                return "disposable" as const;
            }
            foo() {
                return "bar";
            }
            [Symbol.dispose]() {
                disposed++;
            }
        }

        const container = new DiContainer().inject(DisposableService);

        // Force instantiation
        expect(container.disposable.foo()).toBe("bar");

        container[Symbol.dispose]();
        expect(disposed).toBe(1);
    });

    it("should not construct services that were never used", () => {
        let constructed = 0;
        let disposed = 0;

        class LazyService implements DiService<"lazy"> {
            getServiceName() {
                return "lazy" as const;
            }
            constructor() {
                constructed++;
            }
            [Symbol.dispose]() {
                disposed++;
            }
        }

        const container = new DiContainer().inject(LazyService);

        container[Symbol.dispose]();

        expect(constructed).toBe(0);
        expect(disposed).toBe(0);
    });

    it("should dispose only the services that were instantiated", () => {
        const disposed: string[] = [];

        class UsedService implements DiService<"used"> {
            getServiceName() {
                return "used" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("used");
            }
        }

        class UnusedService implements DiService<"unused"> {
            getServiceName() {
                return "unused" as const;
            }
            [Symbol.dispose]() {
                disposed.push("unused");
            }
        }

        const container = new DiContainer().inject(UsedService, UnusedService);
        container.used.foo();

        container[Symbol.dispose]();
        expect(disposed).toEqual(["used"]);
    });

    it("should ignore services without a dispose method", () => {
        class PlainService implements DiService<"plain"> {
            getServiceName() {
                return "plain" as const;
            }
            foo() {
                return "bar";
            }
        }

        const container = new DiContainer().inject(PlainService);
        expect(container.plain.foo()).toBe("bar");

        expect(() => container[Symbol.dispose]()).not.toThrow();
    });

    it("should dispose services in reverse registration order", () => {
        const disposed: string[] = [];

        class ServiceA implements DiService<"a"> {
            getServiceName() {
                return "a" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("a");
            }
        }

        class ServiceB implements DiService<"b"> {
            getServiceName() {
                return "b" as const;
            }
            constructor(public di: Di<ServiceA>) {}
            foo() {
                this.di.a.foo();
            }
            [Symbol.dispose]() {
                disposed.push("b");
            }
        }

        const container = new DiContainer().inject(ServiceA).inject(ServiceB);
        container.a.foo();
        container.b.foo();

        container[Symbol.dispose]();

        // The most recently registered service is disposed first
        expect(disposed).toEqual(["b", "a"]);
    });

    it("should dispose in reverse registration order whatever the usage order", () => {
        const disposed: string[] = [];

        class ServiceA implements DiService<"a"> {
            getServiceName() {
                return "a" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("a");
            }
        }

        class ServiceB implements DiService<"b"> {
            getServiceName() {
                return "b" as const;
            }
            constructor(public di: Di<ServiceA>) {}
            foo() {
                this.di.a.foo();
            }
            [Symbol.dispose]() {
                disposed.push("b");
            }
        }

        const container = new DiContainer().inject(ServiceA).inject(ServiceB);
        // `a` is only instantiated inside `b.foo()`, so it is created last
        container.b.foo();

        container[Symbol.dispose]();

        // Instantiation order is irrelevant: `b` was registered last
        expect(disposed).toEqual(["b", "a"]);
    });

    it("should dispose services registered in one call in reverse argument order", () => {
        const disposed: string[] = [];

        class ServiceA implements DiService<"a"> {
            getServiceName() {
                return "a" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("a");
            }
        }

        class ServiceB implements DiService<"b"> {
            getServiceName() {
                return "b" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("b");
            }
        }

        class ServiceC implements DiService<"c"> {
            getServiceName() {
                return "c" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("c");
            }
        }

        const container = new DiContainer().inject(
            ServiceA,
            ServiceB,
            ServiceC,
        );
        // Instantiated in an order unrelated to registration
        container.b.foo();
        container.c.foo();
        container.a.foo();

        container[Symbol.dispose]();

        expect(disposed).toEqual(["c", "b", "a"]);
    });

    it("should dispose across `inject` calls in one continuous order", () => {
        const disposed: string[] = [];

        class ServiceA implements DiService<"a"> {
            getServiceName() {
                return "a" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("a");
            }
        }

        class ServiceB implements DiService<"b"> {
            getServiceName() {
                return "b" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("b");
            }
        }

        class ServiceC implements DiService<"c"> {
            getServiceName() {
                return "c" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("c");
            }
        }

        class ServiceD implements DiService<"d"> {
            getServiceName() {
                return "d" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("d");
            }
        }

        const container = new DiContainer()
            .inject(ServiceA, ServiceB)
            .inject(ServiceC, ServiceD);
        container.a.foo();
        container.b.foo();
        container.c.foo();
        container.d.foo();

        container[Symbol.dispose]();

        // Argument order and call order are one registration sequence, so
        // splitting the services across calls changes nothing
        expect(disposed).toEqual(["d", "c", "b", "a"]);
    });

    it("should keep the order of the rest when a service is unused", () => {
        const disposed: string[] = [];
        let constructed = 0;

        class FirstService implements DiService<"first"> {
            getServiceName() {
                return "first" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("first");
            }
        }

        class UnusedService implements DiService<"unused"> {
            getServiceName() {
                return "unused" as const;
            }
            constructor() {
                constructed++;
            }
            [Symbol.dispose]() {
                disposed.push("unused");
            }
        }

        class LastService implements DiService<"last"> {
            getServiceName() {
                return "last" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("last");
            }
        }

        const container = new DiContainer().inject(
            FirstService,
            UnusedService,
            LastService,
        );
        container.first.foo();
        container.last.foo();

        container[Symbol.dispose]();

        // The gap left by `unused` does not disturb the remaining order
        expect(constructed).toBe(0);
        expect(disposed).toEqual(["last", "first"]);
    });

    it("should not dispose a service first instantiated by an earlier one", () => {
        const events: string[] = [];

        class CacheService implements DiService<"cache"> {
            getServiceName() {
                return "cache" as const;
            }
            constructor(private di: Di<LoggerService>) {}
            get() {}
            [Symbol.dispose]() {
                // `logger` is registered after `cache`, so the registry has
                // already passed over it by the time this runs
                this.di.logger.log("flushing cache");
            }
        }

        class LoggerService implements DiService<"logger"> {
            getServiceName() {
                return "logger" as const;
            }
            log(message: string) {
                events.push(message);
            }
            [Symbol.dispose]() {
                events.push("logger disposed");
            }
        }

        const container = new DiContainer().inject(CacheService, LoggerService);
        container.cache.get();

        container[Symbol.dispose]();

        // The logger still works, but it is created too late to be disposed
        expect(events).toEqual(["flushing cache"]);
    });

    it("should dispose a service first instantiated by a later one", () => {
        const events: string[] = [];

        class LoggerService implements DiService<"logger"> {
            getServiceName() {
                return "logger" as const;
            }
            log(message: string) {
                events.push(message);
            }
            [Symbol.dispose]() {
                events.push("logger disposed");
            }
        }

        class CacheService implements DiService<"cache"> {
            getServiceName() {
                return "cache" as const;
            }
            constructor(private di: Di<LoggerService>) {}
            get() {}
            [Symbol.dispose]() {
                this.di.logger.log("flushing cache");
            }
        }

        // `logger` is registered before `cache`, so it is still waiting in
        // the registry when `cache.dispose` creates it
        const container = new DiContainer().inject(LoggerService, CacheService);
        container.cache.get();

        container[Symbol.dispose]();

        expect(events).toEqual(["flushing cache", "logger disposed"]);
    });

    it("should call dispose with the service as `this`", () => {
        let self: unknown;

        class StatefulService implements DiService<"stateful"> {
            getServiceName() {
                return "stateful" as const;
            }
            #secret = "hidden";
            reveal() {
                return this.#secret;
            }
            [Symbol.dispose]() {
                self = this;
                // Throws if `this` is not the real instance
                this.reveal();
            }
        }

        const container = new DiContainer().inject(StatefulService);
        expect(container.stateful.reveal()).toBe("hidden");

        container[Symbol.dispose]();
        expect(self).toBeInstanceOf(StatefulService);
    });

    it("should work with the `using` declaration", () => {
        let disposed = 0;

        class DisposableService implements DiService<"disposable"> {
            getServiceName() {
                return "disposable" as const;
            }
            foo() {
                return "bar";
            }
            [Symbol.dispose]() {
                disposed++;
            }
        }

        {
            using container = new DiContainer().inject(DisposableService);
            expect(container.disposable.foo()).toBe("bar");
            expect(disposed).toBe(0);
        }

        expect(disposed).toBe(1);
    });

    it("should let a service use its dependencies while disposing", () => {
        const events: string[] = [];

        class ConnectionService implements DiService<"connection"> {
            getServiceName() {
                return "connection" as const;
            }
            open() {}
            close() {
                events.push("close");
            }
            [Symbol.dispose]() {
                events.push("connection disposed");
            }
        }

        class RepositoryService implements DiService<"repository"> {
            getServiceName() {
                return "repository" as const;
            }
            constructor(private di: Di<ConnectionService>) {
                // Instantiating the dependency here keeps it alive longer
                di.connection.open();
            }
            query() {}
            [Symbol.dispose]() {
                this.di.connection.close();
                events.push("repository disposed");
            }
        }

        // `repository` is registered last, so it is disposed before the
        // connection it still needs
        const container = new DiContainer().inject(
            ConnectionService,
            RepositoryService,
        );
        container.repository.query();

        container[Symbol.dispose]();

        expect(events).toEqual([
            "close",
            "repository disposed",
            "connection disposed",
        ]);
    });

    it("should dispose a service first instantiated while disposing", () => {
        const events: string[] = [];

        class ConnectionService implements DiService<"connection"> {
            getServiceName() {
                return "connection" as const;
            }
            close() {
                events.push("close");
            }
            [Symbol.dispose]() {
                events.push("connection disposed");
            }
        }

        class RepositoryService implements DiService<"repository"> {
            getServiceName() {
                return "repository" as const;
            }
            constructor(private di: Di<ConnectionService>) {}
            query() {}
            [Symbol.dispose]() {
                events.push("repository disposed");
                // First access ever: the connection is created right here
                this.di.connection.close();
            }
        }

        class OtherService implements DiService<"other"> {
            getServiceName() {
                return "other" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                events.push("other disposed");
            }
        }

        const container = new DiContainer().inject(
            ConnectionService,
            RepositoryService,
            OtherService,
        );
        container.other.foo();
        container.repository.query();

        container[Symbol.dispose]();

        // Nothing disposed twice, nothing skipped, the late service disposed.
        // `connection` is registered before `repository`, so it is still
        // waiting in the registry when `repository.dispose` creates it.
        expect(events).toEqual([
            "other disposed",
            "repository disposed",
            "close",
            "connection disposed",
        ]);
    });

    it("should be a no-op when disposed twice", () => {
        let disposed = 0;

        class DisposableService implements DiService<"disposable"> {
            getServiceName() {
                return "disposable" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed++;
            }
        }

        const container = new DiContainer().inject(DisposableService);
        container.disposable.foo();

        container[Symbol.dispose]();
        container[Symbol.dispose]();

        expect(disposed).toBe(1);
    });

    it("should allow a service named `dispose`", () => {
        let disposed = 0;

        class DisposeNamedService implements DiService<"dispose"> {
            getServiceName() {
                return "dispose" as const;
            }
            foo() {
                return "bar";
            }
            [Symbol.dispose]() {
                disposed++;
            }
        }

        const container = new DiContainer().inject(DisposeNamedService);
        expect(container.dispose.foo()).toBe("bar");

        container[Symbol.dispose]();
        expect(disposed).toBe(1);
    });

    describe("service proxy", () => {
        it("should expose dispose of an instantiated service", () => {
            let disposed = 0;

            class DisposableService implements DiService<"disposable"> {
                getServiceName() {
                    return "disposable" as const;
                }
                foo() {}
                [Symbol.dispose]() {
                    disposed++;
                }
            }

            const container = new DiContainer().inject(DisposableService);
            const proxy = container.disposable;
            proxy.foo();

            proxy[Symbol.dispose]();
            expect(disposed).toBe(1);
        });

        it("should not construct a service to dispose it", () => {
            let constructed = 0;

            class LazyService implements DiService<"lazy"> {
                getServiceName() {
                    return "lazy" as const;
                }
                constructor() {
                    constructed++;
                }
                [Symbol.dispose]() {
                    throw Error("unreachable");
                }
            }

            const container = new DiContainer().inject(LazyService);

            expect(() => container.lazy[Symbol.dispose]()).not.toThrow();
            expect(constructed).toBe(0);
        });
    });
});
