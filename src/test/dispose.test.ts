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
        container.b.foo();

        container[Symbol.dispose]();

        // Dependents must be disposed before their dependencies
        expect(disposed).toEqual(["b", "a"]);
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

    it("should dispose services merged from another container", () => {
        let disposed = 0;

        class SharedService implements DiService<"shared"> {
            getServiceName() {
                return "shared" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed++;
            }
        }

        const source = new DiContainer().inject(SharedService);
        const merged = new DiContainer().injectContainer(source);

        merged.shared.foo();
        merged[Symbol.dispose]();

        expect(disposed).toBe(1);
    });

    it("should not treat the internal registry as a service on injectContainer", () => {
        class ServiceA implements DiService<"a"> {
            getServiceName() {
                return "a" as const;
            }
            foo() {
                return "a";
            }
        }

        class ServiceB implements DiService<"b"> {
            getServiceName() {
                return "b" as const;
            }
            foo() {
                return "b";
            }
        }

        // Both containers carry a registry, which must not collide
        const merged = new DiContainer()
            .injectContainer(new DiContainer().inject(ServiceA))
            .injectContainer(new DiContainer().inject(ServiceB));

        expect(merged.a.foo()).toBe("a");
        expect(merged.b.foo()).toBe("b");
    });

    it("should dispose services of every merged container in reverse order", () => {
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

        const merged = new DiContainer()
            .inject(ServiceA)
            .injectContainer(new DiContainer().inject(ServiceB))
            .inject(ServiceC);

        merged.a.foo();
        merged.b.foo();
        merged.c.foo();

        merged[Symbol.dispose]();
        expect(disposed).toEqual(["c", "b", "a"]);
    });

    it("should keep merged containers' registries independent", () => {
        const disposed: string[] = [];

        class SharedService implements DiService<"shared"> {
            getServiceName() {
                return "shared" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("shared");
            }
        }

        class OwnService implements DiService<"own"> {
            getServiceName() {
                return "own" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("own");
            }
        }

        const source = new DiContainer().inject(SharedService);
        const merged = new DiContainer()
            .injectContainer(source)
            .inject(OwnService);

        merged.shared.foo();
        merged.own.foo();

        // Services registered after the merge must not leak back into the source
        source[Symbol.dispose]();
        expect(disposed).toEqual(["shared"]);
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
                this.di.connection.close();
                events.push("repository disposed");
            }
        }

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
        it("should expose dispose of an instantiated service without re-entering", () => {
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

        it("should not construct a service when its dispose is accessed", () => {
            let constructed = 0;

            class LazyService implements DiService<"lazy"> {
                getServiceName() {
                    return "lazy" as const;
                }
                constructor() {
                    constructed++;
                }
                [Symbol.dispose]() {}
            }

            const container = new DiContainer().inject(LazyService);

            expect(container.lazy[Symbol.dispose]).toBeUndefined();
            expect(constructed).toBe(0);
        });
    });
});
