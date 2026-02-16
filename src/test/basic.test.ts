import { describe, expect, it } from "vitest";
import { type Di, DiContainer, type DiService } from "../di";

class RandomNumberService implements DiService<"randomNumber"> {
    getServiceName() {
        return "randomNumber" as const;
    }
    next() {
        return Math.random();
    }
}

class DelayService implements DiService<"delay"> {
    getServiceName() {
        return "delay" as const;
    }
    async wait() {
        return Promise.resolve();
    }
}

class IdService implements DiService<"id"> {
    getServiceName() {
        return "id" as const;
    }
    private counter = 0;
    constructor(private di: Di<RandomNumberService>) {}
    generate() {
        return `${this.counter++}-${this.di.randomNumber.next()}`;
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
        const container = new DiContainer()
            .inject(RandomNumberService)
            .inject(DelayService);

        expect(container.randomNumber).toBeInstanceOf(RandomNumberService);
        expect(container.delay).toBeInstanceOf(DelayService);
    });

    it("should allow a service to depend on another service", () => {
        class DependentService implements DiService<"dependent"> {
            getServiceName() {
                return "dependent" as const;
            }
            constructor(private di: Di<RandomNumberService>) {}
            getWrappedRandom() {
                return { value: this.di.randomNumber.next() };
            }
        }

        const container = new DiContainer()
            .inject(RandomNumberService)
            .inject(DependentService);

        const result = container.dependent.getWrappedRandom();
        expect(result).toHaveProperty("value");
        expect(typeof result.value).toBe("number");
    });

    it("should inject IdService and generate ids using RandomNumberService", () => {
        const container = new DiContainer()
            .inject(RandomNumberService)
            .inject(IdService);

        expect(container.id).toBeInstanceOf(IdService);

        const id1 = container.id.generate();
        const [counter1, rand1] = id1.split("-");
        expect(counter1).toBe("0");
        expect(Number(rand1)).toBeGreaterThanOrEqual(0);

        const id2 = container.id.generate();
        const [counter2, rand2] = id2.split("-");
        expect(counter2).toBe("1");
        expect(Number(rand2)).toBeGreaterThanOrEqual(0);
    });

    it("should merge containers using injectContainer", () => {
        const container1 = new DiContainer().inject(RandomNumberService);
        const container2 = new DiContainer().inject(DelayService);

        const merged = new DiContainer()
            .injectContainer(container1)
            .injectContainer(container2);

        expect(merged.randomNumber).toBeInstanceOf(RandomNumberService);
        expect(merged.delay).toBeInstanceOf(DelayService);
        expect(merged.randomNumber.next()).toBeLessThan(1);
    });
});
