import { describe, it, expect } from "vitest";
import { DiContainer, DiService } from "../di-sacala";

describe("DiContainer inject with name and function", () => {
    it("should inject a simple object using name and function", () => {
        const container = new DiContainer().inject("config", () => ({
            apiUrl: "https://api.example.com",
        }));

        expect(container.config.apiUrl).toBe("https://api.example.com");
    });

    it("should allow function-based service to depend on other services", () => {
        const container = new DiContainer()
            .inject("config", () => ({
                apiUrl: "https://api.example.com",
            }))
            .inject("apiClient", (deps: any) => ({
                get: (path: string) => `${deps.config.apiUrl}${path}`,
            }));

        expect(container.apiClient.get("/users")).toBe(
            "https://api.example.com/users",
        );
    });

    it("should work with classes when mixed", () => {
        const messages: string[] = [];

        class Logger implements DiService<"logger"> {
            getServiceName() {
                return "logger" as const;
            }
            log(msg: string) {
                messages.push(msg);
            }
        }

        const container = new DiContainer()
            .inject(Logger)
            .inject("service", (deps) => ({
                doSomething: () => {
                    deps.logger.log("done");
                    return "ok";
                },
            }));

        expect(container.service.doSomething()).toBe("ok");
        expect(messages).toEqual(["done"]);
        expect(container.logger).toBeInstanceOf(Logger);
    });
});
