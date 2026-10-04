import { css } from "styled-system/css";

/** シリアル・名前の入力欄。16px未満だとiPhoneで画面が拡大されるため lg にする。 */
export const textInput = css({
  flex: "1",
  minW: "0",
  minH: "11",
  px: "3",
  fontSize: "lg",
  borderRadius: "sm",
  borderWidth: "1px",
  borderColor: "line.strong",
  bg: "surface",
  color: "text",
});

/** シリアルの入力欄。0とO、1とIを見分けやすい等幅にする。 */
export const serialInput = css({
  flex: "1",
  minW: "0",
  minH: "11",
  px: "3",
  fontSize: "lg",
  fontFamily: "mono",
  letterSpacing: "wider",
  borderRadius: "sm",
  borderWidth: "1px",
  borderColor: "line.strong",
  bg: "surface",
  color: "text",
});

/** 応募先などのまとまりの枠。色を変えるときは css(cardStyle, {...}) で上書きする。 */
export const cardStyle = css.raw({
  bg: "surface",
  borderRadius: "lg",
  borderWidth: "1px",
  borderColor: "line",
  p: "4",
  display: "grid",
  gap: "3",
});

export const card = css(cardStyle);
