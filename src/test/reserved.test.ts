import { assertType, describe, expect, it } from "vitest";
import { DiContainer, type DiService } from "../di";

class ReservedService implements DiService<"inject"> {
    getServiceName(this: null) {
        return "inject" as const;
    }
}

describe("Reserved fields", () => {
    it("should return error type when injecting reserved service name", () => {
        const container = new DiContainer();

        expect(() => container.inject(ReservedService)).toThrow(
            "Reserved service name: inject",
        );

        const result = null as any as ReturnType<
            typeof container.inject<[ReservedService]>
        >;
        assertType<"Reserved field name: inject">(result);
    });
});
