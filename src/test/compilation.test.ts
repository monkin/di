import { assertType, describe, it } from "vitest";
import { type Di, DiContainer, type DiService } from "../di";

class S1 implements DiService<"s1"> {
    getServiceName() {
        return "s1" as const;
    }
}

class S2 implements DiService<"s2"> {
    getServiceName() {
        return "s2" as const;
    }
    constructor(public deps: Di<S1>) {}
}

class S3 implements DiService<"s3"> {
    getServiceName() {
        return "s3" as const;
    }
    constructor(public deps: Di<S1, S2>) {}
}

class CircularA implements DiService<"a"> {
    getServiceName() {
        return "a" as const;
    }
    constructor(public deps: Di<CircularB>) {}
}

class CircularB implements DiService<"b"> {
    getServiceName() {
        return "b" as const;
    }
    constructor(public deps: Di<CircularA>) {}
}

describe("Compilation errors", () => {
    describe("inject - Missed dependencies", () => {
        it("should fail to compile if dependency is missed", () => {
            const container = new DiContainer();
            // @ts-expect-error: S2 requires s1, but container is empty
            container.inject(S2);
        });

        it("should fail to compile if one of multiple dependencies is missed", () => {
            const container = new DiContainer().inject(S1);
            // @ts-expect-error: S3 requires s1 and s2, but container only has s1
            container.inject(S3);
        });

        it("should compile if all dependencies are present", () => {
            const container = new DiContainer().inject(S1).inject(S2);
            container.inject(S3);
        });
    });

    describe("inject - Multiple dependencies", () => {
        it("should fail to compile if dependency is missed", () => {
            const container = new DiContainer();
            // @ts-expect-error: S2 requires s1
            container.inject(S2);
        });

        it("should compile if dependencies are provided in the same inject call", () => {
            const container = new DiContainer();
            container.inject(S1, S2);
        });

        it("should compile with mutual dependencies in the same inject call", () => {
            const container = new DiContainer();
            container.inject(CircularA, CircularB);
        });

        it("should fail to compile if mutual dependency is missing from the call", () => {
            const container = new DiContainer();
            // @ts-expect-error: CircularA requires CircularB
            container.inject(CircularA);
        });

        it("should fail to compile if one of multiple dependencies is missed in inject", () => {
            const container = new DiContainer().inject(S1);
            // @ts-expect-error: S3 requires s1 and s2, but container only has s1
            container.inject(S3);
        });

        it("should fail to compile if dependency is missed even if others are provided in inject", () => {
            const container = new DiContainer();
            // @ts-expect-error: S3 requires s1 and s2. We provide S1, but not S2.
            container.inject(S1, S3);
        });

        it("should compile if dependency was provided by a previous inject call", () => {
            const container = new DiContainer().inject(S1);
            container.inject(S2);
        });
    });

    describe("Duplicate service names (Type-level)", () => {
        it("inject should return error type for duplicates", () => {
            const container = new DiContainer().inject(S1);
            type Result = ReturnType<typeof container.inject<[S1]>>;
            assertType<"Duplicate service name: s1">({} as Result);
        });

        it("inject should return error type for duplicates within the call", () => {
            const container = new DiContainer();
            type Result = ReturnType<typeof container.inject<[S1, S1]>>;
            assertType<"Duplicate service name: s1">({} as Result);
        });

        it("inject should return error type for duplicates against existing container", () => {
            const container = new DiContainer().inject(S1);
            type Result = ReturnType<typeof container.inject<[S1]>>;
            assertType<"Duplicate service name: s1">({} as Result);
        });

        it("injectContainer should return error type for duplicated keys", () => {
            const c1 = new DiContainer().inject(S1);
            const c2 = new DiContainer().inject(S1);
            type Result = ReturnType<typeof c1.injectContainer<typeof c2>>;
            assertType<"Containers have duplicated keys: s1">({} as Result);
        });

        it("inject should return error type for reserved names", () => {
            class ReservedService implements DiService<"inject"> {
                getServiceName() {
                    return "inject" as const;
                }
            }
            const container = new DiContainer();
            type Result = ReturnType<
                typeof container.inject<[ReservedService]>
            >;
            assertType<"Reserved field name: inject">({} as Result);
        });
    });

    describe("Di type helper", () => {
        it("should not support tuple syntax", () => {
            type Result = Di<[S1, S2]>;
            assertType<never>({} as Result);
        });
    });
});
