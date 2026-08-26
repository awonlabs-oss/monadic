import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from design/tokens.json.
    "src/styles/tokens.generated.css",
    // Generated from the live schema by `npm run types`.
    "src/lib/supabase/types.ts",
  ]),

  /*
   * The service client holds the secret key and bypasses RLS. It exists for
   * ingestion, which writes global tables that have no write policy.
   *
   * Importing it from application code would route user data around every
   * policy in the schema — and worse, it would keep working, so nothing would
   * ever reveal that the policies had stopped being exercised. That makes it a
   * boundary worth enforcing mechanically rather than documenting.
   */
  {
    files: ["src/app/**", "src/components/**", "src/lib/data/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/supabase/service", "@/lib/supabase/service"],
              message:
                "The service client bypasses RLS and is for scripts/ only. " +
                "Use getServerClient() from @/lib/supabase/server, which runs " +
                "with the publishable key and a real session so policies apply.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
