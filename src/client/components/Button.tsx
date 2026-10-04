import type { ComponentProps } from "react";
import { cva, cx, type RecipeVariantProps } from "styled-system/css";

/**
 * ボタンの見た目。色と大きさは variant・size で選び、className では上書きしない
 * （同じ指定を2つのクラスで持つと、どちらが勝つかがCSSの並びで変わるため）。
 * className には位置（余白・揃え・表示の切り替え）だけを渡す。
 */
const button = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.5",
    borderRadius: "md",
    borderWidth: "1px",
    fontSize: "md",
    fontWeight: "bold",
    whiteSpace: "nowrap",
    transition: "[background 0.15s, opacity 0.15s]",
    _disabled: { opacity: "0.5", cursor: "not-allowed" },
  },
  variants: {
    variant: {
      primary: {
        bg: "accent",
        borderColor: "accent",
        color: "accent.fg",
        _enabled: { _hover: { opacity: "0.9" } },
      },
      secondary: {
        bg: "surface",
        borderColor: "line.strong",
        color: "text",
        _enabled: { _hover: { bg: "hover" } },
      },
      danger: {
        bg: "surface",
        borderColor: "danger",
        color: "danger",
        _enabled: { _hover: { bg: "danger.soft" } },
      },
      ghost: {
        bg: "transparent",
        borderColor: "transparent",
        color: "text",
        _enabled: { _hover: { bg: "hover" } },
      },
      /** 一覧の行の「削除」など、枠のない危ない操作。 */
      ghostDanger: {
        bg: "transparent",
        borderColor: "transparent",
        color: "danger",
        _enabled: { _hover: { bg: "danger.soft" } },
      },
    },
    size: {
      /** 写真の読み込みなど、画面の主な操作。 */
      lg: { minH: "14", px: "5", fontSize: "lg", borderRadius: "lg" },
      md: { minH: "11", px: "4" },
      /** 見出しの横や一覧の行の中など、詰めて並べる場所。 */
      sm: { minH: "9", px: "3", fontSize: "sm" },
      /** 矢印などのアイコンだけのボタン。名前は aria-label で付ける。 */
      icon: { w: "11", h: "11", px: "0" },
    },
  },
  defaultVariants: { variant: "secondary", size: "md" },
});

export type ButtonVariants = RecipeVariantProps<typeof button>;

/** ボタン。`type="button"` を既定にする。 */
export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & ButtonVariants) {
  return <button type="button" {...props} className={cx(button({ variant, size }), className)} />;
}
