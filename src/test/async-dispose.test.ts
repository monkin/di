import { describe, expect, it } from "vitest";
import { type Di, DiContainer, type DiService } from "../di";

const tick = () => Promise.resolve();

describe("Async dispose", () => {
    it("should dispose async services in reverse order, one at a time", async () => {
        const events: string[] = [];

        class ServiceA implements DiService<"a"> {
            getServiceName() {
                return "a" as const;
            }
            foo() {}
            async [Symbol.asyncDispose]() {
                events.push("a start");
                await tick();
                events.push("a end");
            }
        }

        class ServiceB implements DiService<"b"> {
            getServiceName() {
                return "b" as const;
            }
            foo() {}
            async [Symbol.asyncDispose]() {
                events.push("b start");
                await tick();
                events.push("b end");
            }
        }

        const container = new DiContainer().inject(ServiceA).inject(ServiceB);
        container.a.foo();
        container.b.foo();

        await container[Symbol.asyncDispose]();

        // `b` finishes before `a` starts: the drain awaits every service
        expect(events).toEqual(["b start", "b end", "a start", "a end"]);
    });

    it("should dispose sync services of an async container", async () => {
        const disposed: string[] = [];

        class SyncService implements DiService<"sync"> {
            getServiceName() {
                return "sync" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("sync");
            }
        }

        class AsyncService implements DiService<"async"> {
            getServiceName() {
                return "async" as const;
            }
            foo() {}
            async [Symbol.asyncDispose]() {
                disposed.push("async");
            }
        }

        const container = new DiContainer().inject(SyncService, AsyncService);
        container.sync.foo();
        container.async.foo();

        await container[Symbol.asyncDispose]();

        expect(disposed).toEqual(["async", "sync"]);
    });

    it("should prefer asyncDispose when a service implements both", async () => {
        const disposed: string[] = [];

        class BothService implements DiService<"both"> {
            getServiceName() {
                return "both" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("sync");
            }
            async [Symbol.asyncDispose]() {
                disposed.push("async");
            }
        }

        const container = new DiContainer().inject(BothService);
        container.both.foo();

        await container[Symbol.asyncDispose]();

        expect(disposed).toEqual(["async"]);
    });

    it("should not construct services that were never used", async () => {
        let constructed = 0;

        class LazyService implements DiService<"lazy"> {
            getServiceName() {
                return "lazy" as const;
            }
            constructor() {
                constructed++;
            }
            async [Symbol.asyncDispose]() {
                throw Error("unreachable");
            }
        }

        const container = new DiContainer().inject(LazyService);

        await container[Symbol.asyncDispose]();

        expect(constructed).toBe(0);
    });

    it("should call asyncDispose with the service as `this`", async () => {
        let self: unknown;

        class StatefulService implements DiService<"stateful"> {
            getServiceName() {
                return "stateful" as const;
            }
            #secret = "hidden";
            reveal() {
                return this.#secret;
            }
            async [Symbol.asyncDispose]() {
                self = this;
                // Throws if `this` is not the real instance
                this.reveal();
            }
        }

        const container = new DiContainer().inject(StatefulService);
        expect(container.stateful.reveal()).toBe("hidden");

        await container[Symbol.asyncDispose]();
        expect(self).toBeInstanceOf(StatefulService);
    });

    it("should work with the `await using` declaration", async () => {
        let disposed = 0;

        class AsyncService implements DiService<"async"> {
            getServiceName() {
                return "async" as const;
            }
            foo() {
                return "bar";
            }
            async [Symbol.asyncDispose]() {
                disposed++;
            }
        }

        {
            await using container = new DiContainer().inject(AsyncService);
            expect(container.async.foo()).toBe("bar");
            expect(disposed).toBe(0);
        }

        expect(disposed).toBe(1);
    });

    it("should dispose a service first instantiated while disposing", async () => {
        const events: string[] = [];

        class ConnectionService implements DiService<"connection"> {
            getServiceName() {
                return "connection" as const;
            }
            close() {
                events.push("close");
            }
            async [Symbol.asyncDispose]() {
                events.push("connection disposed");
            }
        }

        class RepositoryService implements DiService<"repository"> {
            getServiceName() {
                return "repository" as const;
            }
            constructor(private di: Di<ConnectionService>) {}
            query() {}
            async [Symbol.asyncDispose]() {
                events.push("repository disposed");
                // First access ever: the connection is created right here
                this.di.connection.close();
            }
        }

        const container = new DiContainer().inject(
            ConnectionService,
            RepositoryService,
        );
        container.repository.query();

        await container[Symbol.asyncDispose]();

        expect(events).toEqual([
            "repository disposed",
            "close",
            "connection disposed",
        ]);
    });

    it("should be a no-op when disposed twice", async () => {
        let disposed = 0;

        class AsyncService implements DiService<"async"> {
            getServiceName() {
                return "async" as const;
            }
            foo() {}
            async [Symbol.asyncDispose]() {
                disposed++;
            }
        }

        const container = new DiContainer().inject(AsyncService);
        container.async.foo();

        await container[Symbol.asyncDispose]();
        await container[Symbol.asyncDispose]();

        expect(disposed).toBe(1);
    });

    describe("service proxy", () => {
        it("should not construct a service to async dispose it", async () => {
            let constructed = 0;

            class LazyService implements DiService<"lazy"> {
                getServiceName() {
                    return "lazy" as const;
                }
                constructor() {
                    constructed++;
                }
                async [Symbol.asyncDispose]() {
                    throw Error("unreachable");
                }
            }

            const container = new DiContainer().inject(LazyService);

            await container.lazy[Symbol.asyncDispose]();
            expect(constructed).toBe(0);
        });
    });
});
