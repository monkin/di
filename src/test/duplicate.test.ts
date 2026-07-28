import { assertType, describe, expect, it } from "vitest";
import { type Di, DiContainer, type DiService } from "../di";

class S1 implements DiService<"s1"> {
    getServiceName() {
        return "s1" as const;
    }
}

class S1_Duplicate implements DiService<"s1"> {
    getServiceName() {
        return "s1" as const;
    }
}

class S2 implements DiService<"s2"> {
    getServiceName() {
        return "s2" as const;
    }
}

describe("Duplicated services", () => {
    it("should return error type when injecting duplicated service name", () => {
        const container = new DiContainer().inject(S1);

        expect(() => container.inject(S1_Duplicate)).toThrow(
            "Duplicated service name: s1",
        );

        const result = null as any as ReturnType<
            typeof container.inject<[S1_Duplicate]>
        >;
        assertType<"Duplicate service name: s1">(result);
    });

    it("should allow injecting different services", () => {
        const container = new DiContainer().inject(S1).inject(S2);

        assertType<DiContainer & Di<S1, S2>>(container);
    });
});
