import { describe, expect, it } from "vitest";
import { Di, DiContainer, DiService } from "../di-sacala";

class ServiceA implements DiService<"a"> {
    getServiceName() {
        return "a" as const;
    }
    getValue() {
        return "A";
    }
}

class ServiceB implements DiService<"b"> {
    getServiceName() {
        return "b" as const;
    }
    constructor(public deps: Di<ServiceA>) {}
    getValue() {
        return `B${this.deps.a.getValue()}`;
    }
}

class ServiceC implements DiService<"c"> {
    getServiceName() {
        return "c" as const;
    }
    constructor(public deps: Di<[ServiceA, ServiceB]>) {}
    getValue() {
        return `C${this.deps.a.getValue()}${this.deps.b.getValue()}`;
    }
}

describe("injectAll", () => {
    it("should inject multiple services at once", () => {
        const container = new DiContainer().injectAll(ServiceA, ServiceB);
        expect(container.a).toBeInstanceOf(ServiceA);
        expect(container.b).toBeInstanceOf(ServiceB);
        expect(container.b.getValue()).toBe("BA");
    });

    it("should support services depending on each other in injectAll", () => {
        // Here ServiceC depends on A and B, and they are all injected together
        const container = new DiContainer().injectAll(
            ServiceA,
            ServiceB,
            ServiceC,
        );
        expect(container.c.getValue()).toBe("CABA");
    });

    it("should support order-independent injection in injectAll (lazy loading)", () => {
        // ServiceB depends on ServiceA, but we can list them in any order
        const container = new DiContainer().injectAll(ServiceB, ServiceA);
        expect(container.b.getValue()).toBe("BA");
    });

    it("should throw error on duplicate service names within injectAll", () => {
        const container = new DiContainer();
        expect(() => container.injectAll(ServiceA, ServiceA)).toThrow(
            "Duplicated service name: a",
        );
    });

    it("should throw error on duplicate service names with existing container", () => {
        const container = new DiContainer().inject(ServiceA);
        expect(() => container.injectAll(ServiceA)).toThrow(
            "Duplicated service name: a",
        );
    });

    it("should throw error on reserved names in injectAll", () => {
        class InjectService implements DiService<"inject"> {
            getServiceName() {
                return "inject" as any;
            }
        }
        const container = new DiContainer();
        expect(() => container.injectAll(InjectService)).toThrow(
            "Reserved service name: inject",
        );
    });
});
