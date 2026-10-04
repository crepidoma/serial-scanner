import { defineConfig, definePreset, defineSemanticTokens, defineTokens } from "@pandacss/dev";
import { preset as pandaPreset } from "@pandacss/preset-panda";

/**
 * 色。ITに詳しくない人が迷わないよう、色の数を絞る。
 * 端末の設定が暗いテーマなら暗い色にする（`_dark`）。
 */
const colors = defineSemanticTokens.colors({
  bg: { value: { base: "#f6f5f2", _dark: "#17161a" } },
  surface: { value: { base: "#ffffff", _dark: "#222126" } },
  hover: { value: { base: "#efede8", _dark: "#2c2b31" } },
  text: {
    DEFAULT: { value: { base: "#1f1d24", _dark: "#f1f0f3" } },
    secondary: { value: { base: "#4f4b57", _dark: "#c4c1ca" } },
    muted: { value: { base: "#6c6774", _dark: "#9f9ba6" } },
  },
  line: {
    DEFAULT: { value: { base: "#dedbd5", _dark: "#38363d" } },
    strong: { value: { base: "#bdb9b1", _dark: "#55525b" } },
  },
  accent: {
    DEFAULT: { value: { base: "#1d5e57", _dark: "#5fc2b5" } },
    fg: { value: { base: "#ffffff", _dark: "#0f1f1d" } },
    soft: { value: { base: "#e3f1ef", _dark: "#1c3532" } },
  },
  done: { value: { base: "#2f6b2f", _dark: "#8fd18f" } },
  danger: {
    DEFAULT: { value: { base: "#b42318", _dark: "#f59e94" } },
    soft: { value: { base: "#fdf0ee", _dark: "#3a1f22" } },
  },
  warn: {
    DEFAULT: { value: { base: "#8a4508", _dark: "#f5c48a" } },
    soft: { value: { base: "#fcebd2", _dark: "#3a2e17" } },
  },
});

const tokens = defineTokens({
  /** 文字の大きさ。スマホの入力欄はiPhoneの自動ズームを防ぐため lg（16px）以上にする。 */
  fontSizes: {
    xs: { value: "12px" },
    sm: { value: "13px" },
    md: { value: "15px" },
    lg: { value: "16px" },
    xl: { value: "18px" },
    "2xl": { value: "22px" },
  },
  fonts: {
    body: {
      value:
        '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", sans-serif',
    },
    /** シリアル。0とO、1とIを見分けやすい等幅の書体。 */
    mono: { value: 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace' },
  },
  radii: {
    sm: { value: "8px" },
    md: { value: "12px" },
    lg: { value: "16px" },
    full: { value: "9999px" },
  },
  shadows: {
    sm: { value: "0 1px 3px rgba(31, 29, 36, 0.12)" },
  },
});

/**
 * 余白などは既定のプリセットを使い、色・書体・文字の大きさ・角丸・影はこのサイトの値だけにする。
 * 既定の色パレットが残ると、トークンを経由しない色が紛れ込むため外す。
 */
const basePreset = definePreset({
  name: "serial-scanner-base",
  theme: {
    ...pandaPreset.theme,
    tokens: {
      ...pandaPreset.theme?.tokens,
      colors: {
        current: { value: "currentColor" },
        transparent: { value: "transparent" },
        white: { value: "#ffffff" },
        black: { value: "#000000" },
      },
      fonts: {},
      fontSizes: {},
      radii: {},
      shadows: {},
    },
  },
});

export default defineConfig({
  presets: ["@pandacss/preset-base", basePreset],
  preflight: true,
  include: ["./src/client/**/*.{ts,tsx}"],
  exclude: [],
  outdir: "styled-system",
  jsxFramework: "react",
  strictTokens: true,
  conditions: {
    extend: {
      dark: "@media (prefers-color-scheme: dark)",
      hoverable: "@media (hover: hover)",
    },
  },
  theme: {
    extend: {
      tokens,
      semanticTokens: { colors },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
    },
  },
  globalCss: {
    "html, body": {
      bg: "bg",
      color: "text",
      fontFamily: "body",
      lineHeight: "1.6",
    },
    html: { WebkitTextSizeAdjust: "100%" },
    ":focus-visible": { outline: "2px solid {colors.accent}", outlineOffset: "2px" },
    "button:not(:disabled)": { cursor: "pointer" },
    button: { WebkitTapHighlightColor: "transparent" },
    "@media (prefers-reduced-motion: reduce)": {
      "*, *::before, *::after": {
        animationDuration: "0.01ms !important",
        transitionDuration: "0.01ms !important",
      },
    },
  },
});
