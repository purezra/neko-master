/**
 * Applies the theme system to app/globals.css on top of the original file:
 *  - rewrites :root / .dark token blocks (dark defaults to Catppuccin Mocha)
 *  - adds decorative tokens used by glass-card / gradient-text / glows
 *  - appends one [data-theme] block per palette from lib/theme-palettes.json
 *
 * Usage: node scripts/gen-theme-css.mjs <path-to-original-globals.css>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const data = JSON.parse(
  fs.readFileSync(path.join(root, "lib/theme-palettes.json"), "utf8"),
);
const cssPath = path.join(root, "app/globals.css");
const originalPath = process.argv[2] ? path.resolve(process.argv[2]) : cssPath;

let css = fs.readFileSync(originalPath, "utf8");

const SPEC = {
  mocha: {
    card: "rgba(24, 24, 37, 0.8)",
    popover: "#181825",
    secondary: "rgba(203, 166, 247, 0.15)",
    ambient: [
      "rgba(137, 180, 250, 0.1)",
      "rgba(203, 166, 247, 0.07)",
      "rgba(137, 220, 235, 0.05)",
    ],
    glass: "rgba(24, 24, 37, 0.6)",
    glassBorder: "rgba(205, 214, 244, 0.08)",
    glassInset: "rgba(205, 214, 244, 0.05)",
    grad: ["blue", "mauve", "sky"],
    glow: [
      "rgba(137, 180, 250, 0.3)",
      "rgba(137, 180, 250, 0.5)",
      "rgba(203, 166, 247, 0.3)",
    ],
    scroll: ["rgba(166, 173, 200, 0.3)", "rgba(166, 173, 200, 0.5)"],
    chart: ["blue", "mauve", "sky", "green", "peach"],
    comment: "Catppuccin Mocha — base #1e1e2e, accent mauve #cba6f7",
  },
  macchiato: {
    card: "rgba(30, 32, 48, 0.8)",
    popover: "#1e2030",
    secondary: "rgba(198, 160, 246, 0.15)",
    ambient: [
      "rgba(138, 173, 244, 0.1)",
      "rgba(198, 160, 246, 0.07)",
      "rgba(145, 215, 227, 0.05)",
    ],
    glass: "rgba(30, 32, 48, 0.6)",
    glassBorder: "rgba(202, 211, 245, 0.08)",
    glassInset: "rgba(202, 211, 245, 0.05)",
    grad: ["blue", "mauve", "sky"],
    glow: [
      "rgba(138, 173, 244, 0.3)",
      "rgba(138, 173, 244, 0.5)",
      "rgba(198, 160, 246, 0.3)",
    ],
    scroll: ["rgba(165, 173, 203, 0.3)", "rgba(165, 173, 203, 0.5)"],
    chart: ["blue", "mauve", "sky", "green", "peach"],
    comment: "Catppuccin Macchiato — base #24273a, accent mauve #c6a0f6",
  },
  frappe: {
    card: "rgba(41, 44, 60, 0.8)",
    popover: "#292c3c",
    secondary: "rgba(202, 158, 230, 0.15)",
    ambient: [
      "rgba(140, 170, 238, 0.1)",
      "rgba(202, 158, 230, 0.07)",
      "rgba(153, 209, 219, 0.05)",
    ],
    glass: "rgba(41, 44, 60, 0.6)",
    glassBorder: "rgba(198, 208, 245, 0.08)",
    glassInset: "rgba(198, 208, 245, 0.05)",
    grad: ["blue", "mauve", "sky"],
    glow: [
      "rgba(140, 170, 238, 0.3)",
      "rgba(140, 170, 238, 0.5)",
      "rgba(202, 158, 230, 0.3)",
    ],
    scroll: ["rgba(165, 173, 206, 0.3)", "rgba(165, 173, 206, 0.5)"],
    chart: ["blue", "mauve", "sky", "green", "peach"],
    comment: "Catppuccin Frappé — base #303446, accent mauve #ca9ee6",
  },
  latte: {
    card: "rgba(255, 255, 255, 0.85)",
    popover: "#ffffff",
    secondary: "rgba(136, 57, 239, 0.1)",
    ambient: [
      "rgba(30, 102, 245, 0.08)",
      "rgba(136, 57, 239, 0.05)",
      "rgba(4, 165, 229, 0.05)",
    ],
    glass: "rgba(255, 255, 255, 0.75)",
    glassBorder: "rgba(76, 79, 105, 0.08)",
    glassInset: "rgba(255, 255, 255, 0.8)",
    grad: ["blue", "mauve", "sky"],
    glow: [
      "rgba(30, 102, 245, 0.25)",
      "rgba(30, 102, 245, 0.45)",
      "rgba(136, 57, 239, 0.25)",
    ],
    scroll: ["rgba(124, 127, 147, 0.3)", "rgba(124, 127, 147, 0.5)"],
    chart: ["blue", "mauve", "sky", "green", "peach"],
    comment: "Catppuccin Latte — base #eff1f5, accent mauve #8839ef",
  },
  dracula: {
    card: "rgba(33, 34, 44, 0.8)",
    popover: "#21222c",
    secondary: "rgba(255, 121, 198, 0.15)",
    ambient: [
      "rgba(139, 233, 253, 0.08)",
      "rgba(189, 147, 249, 0.07)",
      "rgba(255, 121, 198, 0.05)",
    ],
    glass: "rgba(33, 34, 44, 0.6)",
    glassBorder: "rgba(248, 248, 242, 0.08)",
    glassInset: "rgba(248, 248, 242, 0.05)",
    grad: ["sky", "mauve", "pink"],
    glow: [
      "rgba(139, 233, 253, 0.3)",
      "rgba(139, 233, 253, 0.5)",
      "rgba(189, 147, 249, 0.3)",
    ],
    scroll: ["rgba(164, 166, 192, 0.3)", "rgba(164, 166, 192, 0.5)"],
    chart: ["sky", "mauve", "green", "peach", "pink"],
    comment: "Dracula — base #282a36, accent pink #ff79c6",
  },
};

const byId = Object.fromEntries(data.palettes.map((p) => [p.id, p]));

/** Semantic tokens for one palette. */
function tokens(palette) {
  const spec = SPEC[palette.id];
  if (!spec) throw new Error(`no spec for palette ${palette.id}`);
  const c = palette.colors;
  const isDark = palette.mode === "dark";
  const onAccent = isDark ? c.crust : "#ffffff";
  return [
    `  --background: ${c.base};`,
    `  --foreground: ${c.text};`,
    `  --card: ${spec.card};`,
    `  --card-foreground: ${c.text};`,
    `  --popover: ${spec.popover};`,
    `  --popover-foreground: ${c.text};`,
    `  --primary: ${c[palette.accent]};`,
    `  --primary-foreground: ${onAccent};`,
    `  --secondary: ${spec.secondary};`,
    `  --secondary-foreground: ${c.text};`,
    `  --muted: ${c.surface0};`,
    `  --muted-foreground: ${c.subtext0};`,
    `  --accent: ${spec.secondary};`,
    `  --accent-foreground: ${c.text};`,
    `  --destructive: ${c.red};`,
    `  --border: ${c.surface0};`,
    `  --input: ${c.surface0};`,
    `  --ring: ${c[palette.accent]};`,
    ...spec.chart.map((slot, i) => `  --chart-${i + 1}: ${c[slot]};`),
    `  --sidebar: ${c.mantle};`,
    `  --sidebar-foreground: ${c.text};`,
    `  --sidebar-primary: ${c[palette.accent]};`,
    `  --sidebar-primary-foreground: ${onAccent};`,
    `  --sidebar-accent: ${c.surface0};`,
    `  --sidebar-accent-foreground: ${c.text};`,
    `  --sidebar-border: ${c.surface0};`,
    `  --sidebar-ring: ${c[palette.accent]};`,
  ];
}

/** Decorative tokens (glass, gradients, glows, scrollbar, ambient). */
function decorativeTokens(palette) {
  const spec = SPEC[palette.id];
  const c = palette.colors;
  return [
    `  --ambient-1: ${spec.ambient[0]};`,
    `  --ambient-2: ${spec.ambient[1]};`,
    `  --ambient-3: ${spec.ambient[2]};`,
    `  --glass-bg: ${spec.glass};`,
    `  --glass-border: ${spec.glassBorder};`,
    `  --glass-inset: ${spec.glassInset};`,
    `  --gradient-from: ${c[spec.grad[0]]};`,
    `  --gradient-via: ${c[spec.grad[1]]};`,
    `  --gradient-to: ${c[spec.grad[2]]};`,
    `  --glow-primary: ${spec.glow[0]};`,
    `  --glow-primary-strong: ${spec.glow[1]};`,
    `  --glow-secondary: ${spec.glow[2]};`,
    `  --scrollbar-thumb: ${spec.scroll[0]};`,
    `  --scrollbar-thumb-hover: ${spec.scroll[1]};`,
  ];
}

/** Replace the declaration block that follows `selector`. */
function replaceBlock(source, selector, bodyLines) {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("\n}", open);
  if (close < 0) throw new Error(`unclosed block: ${selector}`);
  return (
    source.slice(0, open + 1) +
    "\n" +
    bodyLines.join("\n") +
    source.slice(close)
  );
}

// 1. Root tokens keep the existing UniFi light theme, plus decorative defaults.
css = replaceBlock(css, ":root", [
  "  --radius: 0.75rem;",
  "  /* Light Mode - Clean white background */",
  "  --background: #f5f7fa;",
  "  --foreground: #1a1d29;",
  "  --card: #ffffff;",
  "  --card-foreground: #1a1d29;",
  "  --popover: #ffffff;",
  "  --popover-foreground: #1a1d29;",
  "  --primary: #0063ff;",
  "  --primary-foreground: #ffffff;",
  "  --secondary: #e8ecf2;",
  "  --secondary-foreground: #1a1d29;",
  "  --muted: #e8ecf2;",
  "  --muted-foreground: #6b7280;",
  "  --accent: #e8ecf2;",
  "  --accent-foreground: #1a1d29;",
  "  --destructive: #ef4444;",
  "  --border: #e2e8f0;",
  "  --input: #e2e8f0;",
  "  --ring: #0063ff;",
  "  --chart-1: #0063ff;",
  "  --chart-2: #7b61ff;",
  "  --chart-3: #00c7ff;",
  "  --chart-4: #00d084;",
  "  --chart-5: #ff8c42;",
  "  --sidebar: #ffffff;",
  "  --sidebar-foreground: #1a1d29;",
  "  --sidebar-primary: #0063ff;",
  "  --sidebar-primary-foreground: #ffffff;",
  "  --sidebar-accent: #e8ecf2;",
  "  --sidebar-accent-foreground: #1a1d29;",
  "  --sidebar-border: #e2e8f0;",
  "  --sidebar-ring: #0063ff;",
  "",
  "  /* Decorative tokens — overridden per palette below */",
  ...decorativeTokens(byId.mocha).map((line) => line),
]);

// 2. `.dark` carries the default dark palette (Mocha) so there is no flash
//    before `data-theme` is applied.
css = replaceBlock(css, "\n.dark", [
  "  /* Dark Mode - default palette: Catppuccin Mocha */",
  ...tokens(byId.mocha),
  "",
  ...decorativeTokens(byId.mocha),
]);

// 3. Replace hardcoded decorative colors with the tokens.
const replacements = [
  [
    /background-image:\n      radial-gradient\(\n        ellipse at 0% 0%,\n        rgba\(59, 130, 246, 0\.08\) 0%,\n        transparent 50%\n      \),\n      radial-gradient\(\n        ellipse at 100% 0%,\n        rgba\(139, 92, 246, 0\.05\) 0%,\n        transparent 50%\n      \),\n      radial-gradient\(\n        ellipse at 100% 100%,\n        rgba\(6, 182, 212, 0\.05\) 0%,\n        transparent 50%\n      \);/,
    `background-image:
      radial-gradient(ellipse at 0% 0%, var(--ambient-1) 0%, transparent 50%),
      radial-gradient(ellipse at 100% 0%, var(--ambient-2) 0%, transparent 50%),
      radial-gradient(
        ellipse at 100% 100%,
        var(--ambient-3) 0%,
        transparent 50%
      );`,
  ],
  [
    /\.glass-card \{\n  background: rgba\(23, 28, 43, 0\.6\);\n  backdrop-filter: blur\(20px\);\n  -webkit-backdrop-filter: blur\(20px\);\n  border: 1px solid rgba\(255, 255, 255, 0\.08\);\n  box-shadow:\n    0 4px 6px -1px rgba\(0, 0, 0, 0\.1\),\n    0 2px 4px -2px rgba\(0, 0, 0, 0\.1\),\n    inset 0 1px 0 0 rgba\(255, 255, 255, 0\.05\);\n\}\n\n\.light \.glass-card \{\n  background: rgba\(255, 255, 255, 0\.8\);\n  border: 1px solid rgba\(0, 0, 0, 0\.06\);\n  box-shadow:\n    0 4px 6px -1px rgba\(0, 0, 0, 0\.05\),\n    0 2px 4px -2px rgba\(0, 0, 0, 0\.05\),\n    inset 0 1px 0 0 rgba\(255, 255, 255, 0\.8\);\n\}/,
    `.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 0 var(--glass-inset);
}`,
  ],
  [
    /background: linear-gradient\(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%\);/,
    `background: linear-gradient(
    135deg,
    var(--gradient-from) 0%,
    var(--gradient-via) 50%,
    var(--gradient-to) 100%
  );`,
  ],
  [
    /box-shadow: 0 0 20px rgba\(59, 130, 246, 0\.3\);/,
    "box-shadow: 0 0 20px var(--glow-primary);",
  ],
  [
    /box-shadow: 0 0 20px rgba\(139, 92, 246, 0\.3\);/,
    "box-shadow: 0 0 20px var(--glow-secondary);",
  ],
  [
    /background: rgba\(148, 163, 184, 0\.3\);/,
    "background: var(--scrollbar-thumb);",
  ],
  [
    /background: rgba\(148, 163, 184, 0\.5\);/,
    "background: var(--scrollbar-thumb-hover);",
  ],
  [
    /box-shadow: 0 0 20px rgba\(59, 130, 246, 0\.3\);/,
    "box-shadow: 0 0 20px var(--glow-primary);",
  ],
  [
    /box-shadow: 0 0 30px rgba\(59, 130, 246, 0\.5\);/,
    "box-shadow: 0 0 30px var(--glow-primary-strong);",
  ],
];
for (const [pattern, replacement] of replacements) {
  if (!pattern.test(css)) throw new Error(`pattern not found: ${pattern}`);
  css = css.replace(pattern, replacement);
}

// 4. Append palette blocks before @layer base so utilities still win.
const layerIndex = css.indexOf("@layer base {");
if (layerIndex < 0) throw new Error("@layer base not found");

const blocks = data.palettes.map((palette) => {
  const spec = SPEC[palette.id];
  const lines = [
    ...tokens(palette),
    "",
    "  /* Decorative tokens */",
    ...decorativeTokens(palette),
    "",
    "  /* Full 26-slot palette — accents first, then Text → Crust */",
    ...Object.entries(palette.colors).map(
      ([slot, value]) => `  --${slot}: ${value};`,
    ),
  ];
  return `/* ${spec.comment} */\n[data-theme="${palette.id}"] {\n${lines.join("\n")}\n}\n`;
});

const section = `/* ---------------------------------------------------------------------------
 * Palette blocks (id matches \`lib/theme-palettes.ts\`)
 * next-themes sets both the mode class (light/dark) and data-theme (palette).
 * ------------------------------------------------------------------------- */

${blocks.join("\n")}`;

css = css.slice(0, layerIndex) + section + "\n" + css.slice(layerIndex);

fs.writeFileSync(cssPath, css);
console.log(
  `wrote ${data.palettes.length} palette blocks (${data.palettes.reduce(
    (n, p) => n + Object.keys(p.colors).length,
    0,
  )} colors)`,
);
