import { describe, expect, it } from "vitest";
import { DiContainer, DiService } from "../di-sacala";

describe("Lazy construction", () => {
    it("should not construct service on container field access", () => {
        let constructed = 0;
        class LazyService implements DiService<"lazy"> {
            getServiceName() {
                return "lazy" as const;
            }
            constructor() {
                constructed++;
            }
            foo() {
                return "bar";
            }
        }

        const container = new DiContainer().inject(LazyService);

        // Accessing the field should return the proxy but not call the constructor
        const s = container.lazy;
        expect(constructed).toBe(0);

        // Accessing a property should trigger construction
        expect(s.foo()).toBe("bar");
        expect(constructed).toBe(1);

        // Subsequent accesses should not trigger construction again
        expect(s.foo()).toBe("bar");
        expect(constructed).toBe(1);
    });

    it("should construct service when prototype is accessed", () => {
        let constructed = 0;
        class LazyService implements DiService<"lazy"> {
            getServiceName() {
                return "lazy" as const;
            }
            constructor() {
                constructed++;
            }
        }

        const container = new DiContainer().inject(LazyService);

        expect(constructed).toBe(0);
        expect(container.lazy).toBeInstanceOf(LazyService);
        expect(constructed).toBe(1);
    });

    it("should handle lazily constructed dependencies", () => {
        let serviceAConstructed = 0;
        let serviceBConstructed = 0;

        class ServiceA implements DiService<"a"> {
            getServiceName() {
                return "a" as const;
            }
            constructor() {
                serviceAConstructed++;
            }
            doA() {
                return "a";
            }
        }

        class ServiceB implements DiService<"b"> {
            getServiceName() {
                return "b" as const;
            }
            constructor(public di: { a: ServiceA }) {
                serviceBConstructed++;
            }
            doB() {
                return this.di.a.doA() + "b";
            }
        }

        const container = new DiContainer().inject(ServiceA).inject(ServiceB);

        expect(serviceAConstructed).toBe(0);
        expect(serviceBConstructed).toBe(0);

        // Access container.b (proxy)
        const b = container.b;
        expect(serviceAConstructed).toBe(0);
        expect(serviceBConstructed).toBe(0);

        // Trigger B construction
        expect(b.doB()).toBe("ab");
        expect(serviceBConstructed).toBe(1);
        expect(serviceAConstructed).toBe(1);
    });

    it("should not construct service when checking if field exists in container", () => {
        let constructed = 0;
        class LazyService implements DiService<"lazy"> {
            getServiceName() {
                return "lazy" as const;
            }
            constructor() {
                constructed++;
            }
        }

        const container = new DiContainer().inject(LazyService);
        expect(constructed).toBe(0);

        expect("lazy" in container).toBe(true);
        expect(constructed).toBe(0);

        expect(Object.keys(container)).toContain("lazy");
        expect(constructed).toBe(0);

        const values = Object.values(container);
        expect(constructed).toBe(0);

        const hasProxy = values.some((v) => v === container.lazy);
        expect(hasProxy).toBe(true);
        expect(constructed).toBe(0);
    });
});
