// @ts-check
// シリアルを応募サイトの入力欄へ入れるブックマークレット。
// 入力欄に値を入れるだけで、登録ボタンは押さない。外部との通信もしない。
(() => {
  const PANEL_ID = "serial-scanner-panel";
  /** 応募サイトが一度に受け付けるシリアルの数 */
  const MAX = 10;

  /** @param {number} ms */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** @returns {HTMLInputElement[]} */
  const serialInputs = () =>
    [...document.querySelectorAll('input[id^="inputSerial"]')].filter(
      (el) => el instanceof HTMLInputElement,
    );

  const addButton = () =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("入力枠を追加"));

  /**
   * 応募サイトはReactで作られており、value を直接書き換えるだけでは画面の状態に反映されない。
   * 本来のsetterで値を入れてから input イベントを送り、手で入力したのと同じ扱いにする。
   * @param {HTMLInputElement} el
   * @param {string} value
   */
  const setValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  /** @param {string} text */
  const parse = (text) => {
    const list = text.match(/[A-Za-z0-9]{6,}/g) ?? [];
    return [...new Set(list)];
  };

  document.getElementById(PANEL_ID)?.remove();

  if (serialInputs().length === 0) {
    alert("シリアルナンバー登録の画面を開いてから、もう一度実行してください。");
    return;
  }

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.setAttribute(
    "style",
    [
      "position:fixed",
      "left:8px",
      "right:8px",
      "top:8px",
      "z-index:2147483647",
      "max-width:480px",
      "margin:0 auto",
      "padding:16px",
      "background:#fff",
      "color:#1f1b24",
      "border:2px solid #1f1b24",
      "border-radius:12px",
      "box-shadow:0 8px 24px rgba(0,0,0,.25)",
      "font:16px/1.6 sans-serif",
    ].join(";"),
  );

  const title = document.createElement("p");
  title.textContent = "シリアルを貼り付けてください（10件まで）";
  title.setAttribute("style", "margin:0 0 8px;font-weight:bold");

  const textarea = document.createElement("textarea");
  textarea.rows = 6;
  textarea.placeholder = "ここを長押しして「ペースト」";
  // 16px未満だとiPhoneで画面が拡大されるため
  textarea.setAttribute(
    "style",
    "width:100%;box-sizing:border-box;font:16px/1.5 monospace;padding:8px;border:1px solid #888;border-radius:8px",
  );

  const message = document.createElement("p");
  message.setAttribute("style", "margin:8px 0 0;font-size:14px;white-space:pre-line");

  const buttons = document.createElement("div");
  buttons.setAttribute("style", "display:flex;gap:8px;margin-top:12px");

  /** @param {string} label @param {boolean} primary */
  const makeButton = (label, primary) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute(
      "style",
      `flex:1;min-height:44px;border-radius:8px;font:bold 16px sans-serif;border:2px solid #1f1b24;${
        primary ? "background:#1f1b24;color:#fff" : "background:#fff;color:#1f1b24"
      }`,
    );
    return b;
  };
  const fillButton = makeButton("入力する", true);
  const closeButton = makeButton("閉じる", false);
  closeButton.onclick = () => panel.remove();

  fillButton.onclick = async () => {
    const serials = parse(textarea.value);
    if (serials.length === 0) {
      message.textContent = "シリアルが見つかりません。コピーした内容を貼り付けてください。";
      return;
    }
    const take = serials.slice(0, MAX);
    fillButton.disabled = true;

    // 入力欄が足りなければ、サイトの「入力枠を追加」を押して増やす
    for (let i = 0; i < MAX && serialInputs().length < take.length; i++) {
      const add = addButton();
      if (!add) break;
      add.click();
      await wait(50);
    }

    const inputs = serialInputs();
    for (let i = 0; i < inputs.length; i++) {
      const el = inputs[i];
      if (!el) continue;
      setValue(el, take[i] ?? "");
      // 入力のたびにサイトの画面が描き直されるのを待つ。続けて送ると前の値が消えることがある
      await wait(30);
    }

    const filled = Math.min(take.length, inputs.length);
    // 入力欄の maxLength はそのイベントのシリアルの桁数
    const expected = Number(inputs[0]?.maxLength);
    const wrongLength =
      expected > 0 ? take.slice(0, filled).filter((s) => s.length !== expected) : [];
    const lines = [
      `${filled}件を入力しました。内容を確かめてから「シリアルナンバー登録」を押してください。`,
    ];
    if (wrongLength.length > 0) {
      lines.push(`⚠ ${expected}桁ではないシリアルがあります：${wrongLength.join("、")}`);
    }
    if (serials.length > filled) {
      lines.push(`残りの${serials.length - filled}件は、登録のあとでもう一度入力してください。`);
    }
    message.textContent = lines.join("\n");
    fillButton.disabled = false;
    title.textContent = "入力しました";
    textarea.style.display = "none";
    fillButton.style.display = "none";
  };

  buttons.append(fillButton, closeButton);
  panel.append(title, textarea, buttons, message);
  document.body.append(panel);
  textarea.focus();
})();
