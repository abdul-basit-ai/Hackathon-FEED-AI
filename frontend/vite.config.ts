// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Pre-bundle UI libraries so Vite doesn't re-optimize mid-session (which loads two React copies).
  vite: {
    optimizeDeps: {
      include: [
        "@radix-ui/react-dialog",
        "@radix-ui/react-select",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-label",
        "@radix-ui/react-slot",
        "recharts",
        "sonner",
        "lucide-react",
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
