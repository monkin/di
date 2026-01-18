import { describe, it, expect } from "vitest";
import { DiContainer, DiService } from "./di-sacala";

class RandomNumberService implements DiService<"randomNumber"> {
    name = "randomNumber" as const;
    constructor() {}
    next() {
        return Math.random();
    }
}

class DelayService implements DiService<"delay"> {
    name = "delay" as const;
    constructor() {}
    async wait() {
        return Promise.resolve();
    }
}

describe("DiContainer", () => {
    it("should inject RandomNumberService and use it", () => {
        const container = new DiContainer().inject(RandomNumberService);
        expect(container.randomNumber).toBeInstanceOf(RandomNumberService);
        const val = container.randomNumber.next();
        expect(typeof val).toBe("number");
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
    });

    it("should inject multiple services and they should be accessible", () => {
        const container = new DiContainer().inject(RandomNumberService).inject(DelayService);

        expect(container.randomNumber).toBeInstanceOf(RandomNumberService);
        expect(container.delay).toBeInstanceOf(DelayService);
    });

    it("should allow a service to depend on another service", () => {
        class DependentService implements DiService<"dependent"> {
            name = "dependent" as const;
            constructor(private di: DiContainer & { randomNumber: RandomNumberService }) {}
            getWrappedRandom() {
                return { value: this.di.randomNumber.next() };
            }
        }

        const container = new DiContainer().inject(RandomNumberService).inject(DependentService);

        const result = container.dependent.getWrappedRandom();
        expect(result).toHaveProperty("value");
        expect(typeof result.value).toBe("number");
    });

    it("should merge containers using injectContainer", () => {
        const container1 = new DiContainer().inject(RandomNumberService);
        const container2 = new DiContainer().inject(DelayService);

        const merged = new DiContainer().injectContainer(container1).injectContainer(container2);

        expect(merged.randomNumber).toBeInstanceOf(RandomNumberService);
        expect(merged.delay).toBeInstanceOf(DelayService);
        expect(merged.randomNumber.next()).toBeLessThan(1);
    });
});
