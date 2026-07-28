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

    it("should reject `_`, the internal service registry", () => {
        class UnderscoreService implements DiService<"_"> {
            getServiceName(this: null) {
                return "_" as const;
            }
        }

        const container = new DiContainer();

        expect(() => container.inject(UnderscoreService)).toThrow(
            "ed service name: _",
        );

        const result = null as any as ReturnType<
            typeof container.inject<[UnderscoreService]>
        >;
        assertType<"Reserved field name: _">(result);
    });
});
