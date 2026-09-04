import { beforeEach, describe, expect, it } from "vitest";
import { type Di, DiContainer, type DiService } from "../di";

class ConfigService implements DiService<"config"> {
    getServiceName() {
        return "config" as const;
    }
    get() {
        return "value";
    }
}

class RequestService implements DiService<"request"> {
    getServiceName() {
        return "request" as const;
    }
    constructor(private di: Di<ConfigService>) {}
    describe() {
        return `request with ${this.di.config.get()}`;
    }
}

describe("Parent container", () => {
    it("should expose parent services on the child", () => {
        const parent = new DiContainer().inject(ConfigService);
        const child = new DiContainer(parent);

        expect(child.config.get()).toBe("value");
    });

    it("should let a child service depend on a parent service", () => {
        const parent = new DiContainer().inject(ConfigService);
        const child = new DiContainer(parent).inject(RequestService);

        expect(child.request.describe()).toBe("request with value");
    });

    it("should share a parent service first touched through the child", () => {
        let constructed = 0;

        class CountedService implements DiService<"counted"> {
            getServiceName() {
                return "counted" as const;
            }
            constructor() {
                constructed++;
            }
            foo() {}
        }

        const parent = new DiContainer().inject(CountedService);
        const child = new DiContainer(parent);

        child.counted.foo();
        parent.counted.foo();

        expect(constructed).toBe(1);
    });

    it("should expose grandparent services on a grandchild", () => {
        const grandparent = new DiContainer().inject(ConfigService);
        const parent = new DiContainer(grandparent);
        const child = new DiContainer(parent).inject(RequestService);

        expect(child.request.describe()).toBe("request with value");
    });

    it("should see services injected into the parent after the child was created", () => {
        const parent = new DiContainer();
        const child = new DiContainer(parent);
        parent.inject(ConfigService);

        expect((child as any).config.get()).toBe("value");
    });

    it("should reject a service name the parent already has", () => {
        const parent = new DiContainer().inject(ConfigService);
        const child = new DiContainer(parent);

        expect(() => child.inject(ConfigService)).toThrow(
            "Duplicated service name: config",
        );
    });

    describe("disposal", () => {
        let disposed: string[] = [];
        beforeEach(() => {
            disposed = [];
        });

        class ConnectionService implements DiService<"connection"> {
            getServiceName() {
                return "connection" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("connection");
            }
        }

        class SessionService implements DiService<"session"> {
            getServiceName() {
                return "session" as const;
            }
            foo() {}
            [Symbol.dispose]() {
                disposed.push("session");
            }
        }

        class AsyncSessionService implements DiService<"asyncSession"> {
            getServiceName() {
                return "asyncSession" as const;
            }
            foo() {}
            async [Symbol.asyncDispose]() {
                disposed.push("asyncSession");
            }
        }

        it("should dispose only the child's own services", () => {
            const parent = new DiContainer().inject(ConnectionService);
            const child = new DiContainer(parent).inject(SessionService);
            child.connection.foo();
            child.session.foo();

            child[Symbol.dispose]();

            expect(disposed).toEqual(["session"]);
        });

        it("should leave child services alone when the parent is disposed", () => {
            const parent = new DiContainer().inject(ConnectionService);
            const child = new DiContainer(parent).inject(SessionService);
            child.connection.foo();
            child.session.foo();

            parent[Symbol.dispose]();

            expect(disposed).toEqual(["connection"]);
        });

        it("should dispose only the child's own services asynchronously", async () => {
            const parent = new DiContainer().inject(ConnectionService);
            const child = new DiContainer(parent).inject(AsyncSessionService);
            child.connection.foo();
            child.asyncSession.foo();

            await child[Symbol.asyncDispose]();

            expect(disposed).toEqual(["asyncSession"]);
        });
    });
});
