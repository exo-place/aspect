const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/public/index.html" : url.pathname;
    const file = Bun.file(
      path.startsWith("/public/") ? `.${path}` : `./public${path}`,
    );
    if (path.startsWith("/src/")) {
      const src = Bun.file(`.${path}`);
      if (await src.exists()) {
        const built = await Bun.build({ entrypoints: [`.${path}`], target: "browser" });
        const output = built.outputs[0];
        return new Response(output, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }
    if (path.endsWith(".css")) {
      const css = Bun.file(`.${path}`);
      if (await css.exists()) {
        return new Response(css, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }
    if (await file.exists()) return new Response(file);
    // SPA fallback
    return new Response(Bun.file("./public/index.html"));
  },
});

console.log(`aspect dev server: http://localhost:${server.port}`);
