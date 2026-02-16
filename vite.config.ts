import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import { transform } from "esbuild";

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, "src/di.ts"),
            name: "Di",
            fileName: "index",
        },
        minify: "terser",
    },
    plugins: [
        dts({ exclude: ["**/*.test.ts"] }),
        {
            name: "remove-comments",
            async renderChunk(code) {
                const result = await transform(code, {
                    minify: true,
                    legalComments: "none",
                });
                return {
                    code: result.code,
                    map: result.map,
                };
            },
        },
        {
            name: "force-remove-comments",
            generateBundle(_options, bundle) {
                for (const fileName in bundle) {
                    const file = bundle[fileName];
                    if (file.type === "chunk") {
                        file.code = file.code.replace(/\/\*[\s\S]*?\*\//g, "");
                    }
                }
            },
        },
    ],
});
