# jCALC — Design Specification

This document describes jCALC completely enough to rebuild it from scratch. It covers layout, interaction, every function, number handling, precision and error behaviour. Visual styling (colors, fonts, shadows, exact radii) is intentionally left out; choose any styling that keeps the layout and behaviour described here.

Conventions used below:

- **Level 1** is the bottom of the stack (most recent value), level 2 the one above it, and so on.
- For two-argument functions, **y** is level 2 and **x** is level 1. The result replaces both.
- **Entry** is the number currently being typed (a string), shown in the entry line.
- Quoted strings such as `"Bad argument"` are exact user-visible texts.

---

## 1. Overview

- An RPN (Reverse Polish Notation) calculator in the HP tradition with an **unlimited stack** of decimal floating-point numbers.
- Delivered as **one self-contained HTML file**: no external scripts, stylesheets or fonts. It can be hosted as a static page (e.g. GitHub Pages), alongside a few small support files that make it an installable, offline web app (section 12). The HTML file still works on its own without them.
- **Phone-first**: sized for portrait phone screens, touch-driven, with "hold and slide" menus. It also works in desktop browsers with mouse and keyboard.
- **High precision**: 34 significant decimal digits, computed with an arbitrary-precision decimal library built on JavaScript `BigInt` (section 7).
- Follows the system light/dark preference.

---

## 2. Page setup

- Viewport: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`. Pinch zoom is disabled (also suppress `gesturestart`).
- Home-screen-app metadata: `mobile-web-app-capable`, `apple-mobile-web-app-capable`, translucent status bar, app title and page title `jCALC`.
- The page never scrolls or bounces (`overflow: hidden`, `overscroll-behavior: none`). Text selection, the iOS long-press callout, tap highlight and the browser context menu are all disabled across the page.
- Respect safe-area insets: top inset above the header, bottom inset below the keypad.

---

## 3. Layout

The app is a single column, full viewport height (`100dvh`), at most **560 px** wide and horizontally centered.

```
┌───────────────────────────────────┐
│ jCALC                 DEG · depth 3│  header
├───────────────────────────────────┤
│                                   │
│                                   │  display (fills remaining height)
│ 3:                         1.5    │   - stack rows, bottom-aligned
│ 2:                      -42       │
│ 1:          3.141592653589793…    │
│───────────────────────────────────│
│                         12.5E-3▌  │   - entry line (only while typing)
├───────────────────────────────────┤
│  ↓   │  7   │  8   │  9   │  ÷    │
│  ←   │  4   │  5   │  6   │  ×    │  keypad, 5 × 4 grid
│ENTER │  1   │  2   │  3   │  −    │
│      │  0   │  .   │  E   │  +    │
└───────────────────────────────────┘
```

### 3.1 Header

- A single small text line. Left: the name **jCALC**. Right: the info text.
- The info text is `DEG` or `RAD` (the angle mode). When the stack is not empty it is followed by ` · depth N`, where N is the number of stack values, e.g. `DEG · depth 3`.

### 3.2 Display

A panel that takes all vertical space between the header and the keypad. It holds three things.

**Stack area**

- Shows all stack values, one row per value. Level 1 is at the bottom and higher levels stack upward.
- Rows are bottom-aligned: a flexible spacer above them pushes them down when there are few.
- The area scrolls vertically when there are more rows than fit. After every update it scrolls to the bottom so level 1 is visible.
- Rows use a monospace font, with a thin separator line between rows.
- Each row optionally starts with a **level label** `N:`. It is right-aligned in a column wide enough for the largest level number plus the colon. The labels can be toggled in the MODE menu (section 5.2).
- The value is right-aligned. How it is shortened when too wide is described in section 8.2.

**Entry line**

- Sits below the stack area. It is **collapsed (zero height) whenever the entry is empty** and expands (with a short height animation) as soon as anything is typed.
- Its font is larger than the stack font, and the text is right-aligned with a blinking caret after it.
- If the text is wider than the line, it scrolls horizontally (no visible scrollbar) so the end stays visible.

**Message pill**

- A small rounded label centered horizontally near the bottom of the display. It is raised above the entry line while that line is open.
- It shows one message at a time and fades out after **2 seconds**. A new message replaces the old one and restarts the timer.
- There are two styles: **error** (attention color) and **info** (neutral). Pressing any key or running a menu item hides the current message immediately.

### 3.3 Keypad

- A CSS grid of **5 columns × 4 rows** with 8 px gaps.
- Height is `min(46% of viewport height, 400px)`, but never below 240 px.
- **ENTER spans two rows** (rows 3–4 of column 1).
- Each key shows its **main label** large and centered. Keys that have a hold menu also show a small **hint label** at the top edge, in an accent color. The hint never wraps; it is clipped if too long.
- There are four key styles: control keys (↓, ←), operator keys (÷ × − +), the ENTER key (strong accent; smaller, bold, letter-spaced label), and plain digit keys (everything else).
- A pressed key shows a "down" state.

| Row | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 |
|---|---|---|---|---|---|
| 1 | ↓ (hint CLR) | 7 (hint TRIG) | 8 (hint STO) | 9 (hint RCL) | ÷ (hint `1/x MOD`) |
| 2 | ← | 4 (hint COMB) | 5 | 6 | × (hint `√ x² yˣ`) |
| 3 | ENTER (hint STACK), spans rows 3–4 | 1 | 2 | 3 | − (hint `+/−`) |
| 4 | *(ENTER continued)* | 0 (hint CONST) | . (hint MODE) | E (hint `LOG EXP`) | + |

The minus key's main label is the true minus sign `−` (U+2212). The ↓ key is "drop" and the ← key is "back".

---

## 4. Key behaviour (tap)

### 4.1 Tap timing

- **Keys without a hold menu** (← 5 6 1 2 3 +) act immediately on press (pointer down).
- **Keys with a hold menu** act on release. The tap fires only if the press was shorter than the hold delay (320 ms) and the pointer was released over the same key.
- **←** auto-repeats while held, but only if the entry was non-empty when pressed. The first repeat comes after 450 ms and then every 70 ms; repeating stops when the entry becomes empty.
- Pointer capture keeps a press on its original key even if the finger moves off it.

### 4.2 Tap actions

| Key | Tap action |
|---|---|
| 0–9 | Append the digit to the entry. |
| . | Append a decimal point. Ignored if the entry already contains `.` or `E`. If the entry is empty or just `-`, insert `0.` instead. |
| E | Start the exponent: append `E`. Ignored if the entry already has an `E`. **Special case:** while the entry ends with `E`, the key's label changes to `−` (shown in the accent color) and tapping it appends `-`, so negative exponents can be typed as `E`,`E`,digits. |
| ENTER | If there is an entry, parse it and push it. If the entry is empty, **duplicate** level 1 (nothing happens on an empty stack). |
| ↓ (drop) | If there is an entry, discard it. Otherwise remove level 1 (no-op on an empty stack, no message). |
| ← (back) | If there is an entry, delete its last character. Otherwise pop level 1 **into the entry for editing**, formatted at full precision. With an empty stack: `"Too few arguments"`. |
| ÷ × − + | y ÷ x, y × x, y − x, y + x. |

Other number-entry rules:

- An entry of `E5` (no mantissa digits) means 1E5. An entry that is just `.` is invalid.
- Typing digits never produces an error. Errors only appear when the entry is parsed.

### 4.3 How functions treat the entry

Every function, operator, stack command, STO and RCL first **commits a non-empty entry** (parses and pushes it). If parsing fails, the error `"Invalid entry"` (or `"Overflow"`/`"Underflow"`) is shown, the entry is kept unchanged and the function does not run. Then:

- If the stack holds fewer values than the function needs: `"Too few arguments"`, nothing changes.
- If the function fails (e.g. divide by zero): show the error and leave the stack unchanged. The committed entry stays on the stack.

---

## 5. Hold menus

### 5.1 Interaction model

These rules are the same for every menu.

1. **Opening.** Press and hold a key that has a hint label for **320 ms**. The menu pops up and the device vibrates briefly (12 ms, where supported).
2. **Placement.** The menu is horizontally centered on the key and clamped to stay 8 px inside the viewport edges. It opens 10 px **above** the key if it fits (8 px from the top), otherwise 10 px below the key.
3. **Sliding.** Without lifting the finger, slide onto an item. The item under the pointer is **highlighted** and each change of highlight gives a short vibration.
4. **Releasing.**
   - Over an item: run that item and close the menu.
   - Back over the original key: the menu **stays open** ("sticky"). It is then operated by tapping: tap an item to run it, or tap anywhere outside to close it without doing anything. With a mouse, hovering highlights items.
   - Anywhere else: close the menu without doing anything.
5. **Cancelling.** A cancelled pointer (e.g. by the system) closes the menu.

Menu contents are a grid of rows of items. Items in a row share the width equally. Each item is about 52 px high and at least 64 px wide. Labels may contain superscripts and subscripts, which must render clearly raised or lowered.

### 5.2 Menu contents

Rows are separated by `/`. Each item is written as label → action.

**↓ — CLR**: three rows, one item each.

- `CLEAR STACK` → empty the stack and discard the entry.
- `CLEAR STORED` → empty all registers.
- `CLEAR ALL` → both of the above.

There is no confirmation for any of them.

**7 — TRIG**: `sin` `cos` `tan` / `sin⁻¹` `cos⁻¹` `tan⁻¹`. All work on x and use the current angle mode (section 7.6).

**8 — STO**: register menu (section 5.3). Stores **a copy** of level 1 in the chosen register; the stack is unchanged.

- Shows the info message `"Stored in A"` (etc.).
- If the stack is empty, all items are shown greyed out. Choosing one anyway shows `"Stack empty"`.
- A pending entry counts as a value: it is committed first and then stored.

**9 — RCL**: register menu. Pushes a copy of the register's value; the register keeps its value. Empty registers are greyed out, and choosing one shows `"Register A is empty"` (etc.).

**÷ — `1/x MOD`**: `1/x` (reciprocal of x) | `MOD` (y mod x, section 7.4).

**4 — COMB**: `x!` | `ₙPᵣ` | `ₙCᵣ`. The P and C items have n and r as subscripts. See section 7.8.

**× — `√ x² yˣ`**: `√x` | `x²` | `yˣ` (y raised to the power x).

**ENTER — STACK**: `SWAP` | `ROT↓` | `ROT↑` / `UNDO`

- `SWAP` exchanges levels 1 and 2.
- `ROT↓` moves level 1 to the **top** of the stack, so everything else moves down one level.
- `ROT↑` moves the **top** value down to level 1, so everything else moves up one level.
- Both ROT commands rotate the *whole* stack and do nothing with fewer than 2 values (no error).
- `UNDO` reverts the last stack change (section 5.5). It is greyed out when there is nothing to undo; choosing it anyway shows `"Undo unavailable"`.

**− — `+/−`**: one item, `+/−` (change sign).

- With an entry, it toggles the sign of the **exponent** if the entry contains `E`, otherwise the sign of the mantissa. The entry stays open.
- With no entry, it negates level 1.

**0 — CONST**: `π` → push π (34 digits).

**. — MODE**: two rows.

- The first item is labelled with the mode it *switches to*: `RAD` while in degree mode, `DEG` while in radian mode. Choosing it toggles the angle mode.
- The second item is a checkbox icon followed by `Stack numbers`. The box is ticked when level labels are shown, and choosing it toggles them. The text never changes; only the box does.

**E — `LOG EXP`**: three rows of inverse pairs, `ln` `eˣ` / `log` `10ˣ` / `log₂` `2ˣ`.

Keys 5, 6, 1, 2, 3, ← and + have no menu.

### 5.3 Register menus (STO / RCL)

- There are six registers: **A, B, C, X, Y, Z**. They are laid out in three rows of two: `A X` / `B Y` / `C Z`.
- Each item is left-aligned and shows the register name and a colon (e.g. `A:`).
- A filled register also shows a short preview of its value, formatted to fit in **7 characters** with the truncation rules of section 8.2.
- Greyed-out items are still selectable; they only look dimmed.

### 5.4 Display context menu (copy, paste, clean-up)

**Opening**

- A long-press (**450 ms**) anywhere in the display opens the context menu, as does a right-click (any pointer type).
- The long-press is cancelled if the pointer moves more than 10 px, is released, or the stack scrolls.

**Items**, shown in a single row:

- `Copy` appears only when the press was on a stack row. It copies that value at full precision (section 8.1).
- `Paste` is always present. It reads the system clipboard and appends to the entry (section 6).
- `→ value` appears only when the pressed value qualifies for rounding clean-up (section 7.10).
  - The label is a right arrow and the cleaned value, formatted to at most 18 characters.
  - Choosing it replaces that stack value in place.

**Behaviour**

- While the menu is open, the pressed stack row is highlighted.
- The menu is centered on the press point: 16 px above it if it fits, otherwise 16 px below.
- After a long-press the menu works like a hold menu: slide (with highlight) and release on an item to run it.
- If you release elsewhere, the menu stays open for tapping; tap outside to dismiss it. After a right-click it is always in this tap mode.
- While sliding to an item, the stack must not scroll (block touch scrolling on the display during the slide).

### 5.5 Undo

Undo is **single-step** and covers **only the stack**.

**What is remembered**

- Before every action that changes the stack, the app saves a copy of the stack as the undo state. This includes:
  - committing the entry, which pushes a value;
  - ENTER duplicating level 1;
  - drop;
  - ← popping level 1 into the entry;
  - all functions and operators;
  - SWAP and ROT;
  - RCL;
  - the `→` rounding clean-up.
- Actions that fail or leave the stack unchanged keep the previous undo state.
- When a function commits a pending entry, the undo state is taken **after** the commit. So `3 ENTER 4 +` gives 7, and undo gives back 3 and 4.

**What undo does**

- With an entry open, undo only **clears and closes the entry line**. The stack and the undo state are untouched, so a second undo then reverts the last stack change.
- Otherwise it restores the saved stack and makes undo **unavailable**. Undoing twice does not redo or go further back.

**What makes undo unavailable**

- a successful undo;
- `CLEAR STACK` or `CLEAR ALL`.

Register changes (STO, `CLEAR STORED`) are never undone and leave the undo state as it is.

---

## 6. Clipboard and keyboard

### 6.1 Copy

- Copy writes the plain value text (section 8.1, full 34 digits) using the async Clipboard API. If that fails, it falls back to a hidden textarea and `execCommand('copy')`.
- Success shows the info message `"Copied <text>"`; texts over 22 characters are cut to 21 characters plus `…`. Failure shows `"Copy failed"`.
- **Ctrl/Cmd+C** copies the entry if there is one, otherwise level 1. It does nothing if both are empty.

### 6.2 Paste

Paste **only ever goes into the entry**: the text is appended to the current entry and is never pushed directly.

- It can be triggered from the context menu (`"Clipboard not accessible"` if reading fails) or with the browser's native paste event (Ctrl/Cmd+V), which closes any open menu.
- The text is normalized first:
  1. Trim, then remove spaces, no-break and thin spaces, `'` and `_` (digit grouping).
  2. Convert `−`, `‒` and `–` to `-`.
  3. Convert `×10^`, `x10^`, `*10^` and `·10^` to `E`.
  4. Convert `e` to `E`, and drop a leading `+` and an exponent `+` (`E+5` → `E5`).
  5. Interpret separators:
     - If both `.` and `,` appear, the last of them is the decimal separator and the other is a grouping separator (`1,234.5` and `1.234,5` both → `1234.5`).
     - If only commas appear: a single comma is the decimal point (`2,5` → `2.5`), several are grouping (`1,234,567` → `1234567`).
- If the normalized text is empty, or *entry + text* would not parse as a number, show `"Invalid paste"` and change nothing.

### 6.3 Physical keyboard

Key repeats are allowed. Any handled key closes an open menu and hides the current message.

| Key | Action |
|---|---|
| `0`–`9` | digit |
| `.` or `,` | decimal point |
| `e` / `E` | E key |
| `Enter` or `=` | ENTER |
| `Backspace` | back |
| `Delete` or `Escape` | drop |
| `+` `*` `/` | add, multiply, divide |
| `-` | subtract; but if the entry ends with `E`, it appends `-` (same as the E key) |
| `^` | yˣ |
| `n` | +/− |
| `s` | SWAP |
| `r` | √x |

| Ctrl/Cmd+`Z` | UNDO |

Keys held with Ctrl, Cmd or Alt are ignored, except Ctrl/Cmd+C and Ctrl/Cmd+Z.

---

## 7. Numbers and mathematics

### 7.1 Number representation

- Every value is a decimal floating-point number **m × 10ᵉ**, where m is an arbitrary-size integer (`BigInt`) and e is an integer.
- **Precision**
  - Every result is rounded to **34 significant decimal digits**, rounding **half away from zero** on the magnitude.
  - Values are stored canonically: no trailing zeros in m, and zero is 0 × 10⁰.
  - Because the arithmetic is decimal, values like 0.1 are exact and `0.1 + 0.2 = 0.3`.
- **Range**
  - The decimal exponent may reach about **±10¹⁵**.
  - A result whose magnitude exceeds 10^(10¹⁵) is an `"Overflow"` error.
  - A result smaller than about 10^(−10¹⁵) silently becomes 0.
  - Any JavaScript `RangeError` (e.g. a BigInt that would get too large) is also reported as `"Overflow"`.
- **No special values.** There is no infinity, NaN or negative zero. Undefined operations raise errors instead (section 9).

### 7.2 Basic arithmetic

- **Add and subtract** are exact before the final rounding to 34 digits. If the operands differ in magnitude by more than 36 digits, the smaller one is ignored.
- **Multiply**: exact product, then rounded.
- **Divide**: computed to 37 digits, then rounded to 34. A zero divisor gives `"Divide by zero"`.
- **1/x** is division of 1 by x.
- **√x**: integer square root of the scaled mantissa, correct to 34 digits. Negative x gives `"Bad argument"`.
- **x²** is x × x.

### 7.3 Powers and logarithms

**yˣ**

- If x is an integer with at most 10 digits, it uses binary exponentiation at 46-digit working precision. A negative x takes the reciprocal at the end.
- Otherwise it computes e^(x·ln y).
- Special cases:
  - y⁰ = 1, including 0⁰.
  - 0 to a positive power is 0; 0 to a negative power gives `"Divide by zero"`.
  - A negative y requires an integer x, otherwise `"Bad argument"`. The result is negative when x is odd.

**Logarithms and exponentials**

- `ln`, `log` (base 10) and `log₂` need x > 0, otherwise `"Bad argument"`.
- `log` of an exact power of ten returns the exact integer.
- `eˣ`
  - If |x| ≥ 10¹⁷, a positive x overflows and a negative x gives 0.
  - Otherwise, results beyond the exponent range overflow as usual.
- `10ˣ` is exact for integer x (up to 16 digits); otherwise it is computed as a general power.
- `2ˣ` is computed as a general power, so integer x is exact via binary exponentiation.

### 7.4 Modulo

- `y MOD x` is computed **exactly** on the decimal values, using floored division: the result has the **sign of x**.
- Examples:
  - `5.0 MOD 1.1 = 0.6` exactly
  - `-7 MOD 3 = 2`
  - `7 MOD -3 = -2`
- A zero x gives `"Divide by zero"`. If the exponents of y and x differ by more than 100 000, it gives `"Bad argument"`.

### 7.5 Internal precision of transcendental functions

- Logarithms, exponentials, powers with non-integer exponents, trigonometry, inverse trigonometry and Gamma are computed in **fixed point with 90 fractional decimal digits**, then rounded to 34 significant digits.
- Results are therefore accurate to all 34 digits for ordinary magnitudes.
- The fixed-point base means extremely small results, such as `ln(1 + 10⁻⁸⁰)`, carry fewer correct significant digits. The tiny-argument shortcuts in section 7.6 handle the common trig cases.

**Constants**, computed once at 90 digits and cached:

- ln 2 = 2·atanh(1/3)
- ln 10 = 3·ln 2 + 2·atanh(1/9)
- π = 16·atan(1/5) − 4·atan(1/239) (Machin's formula)
- π/2, together with the degree↔radian conversion factors

### 7.6 Trigonometry

**Angle mode**

- The angle mode is either degrees (**the default**) or radians. It applies to the inputs of sin/cos/tan and the outputs of the inverse functions.
- |x| ≥ 10⁶⁰ gives `"Bad argument"`.

**Degree mode**

1. The argument is first reduced **exactly** modulo 360 in decimal.
2. Exact multiples of 90° give exact results: sin and cos give 0 or ±1, tan gives 0, and tan(90°)/tan(270°) give `"Infinite result"`.
3. Otherwise the reduced angle is converted to radians.

So `sin(30°) = 0.5` exactly, and `sin(180°) = 0` exactly.

**Radian mode**

- The argument is reduced by multiples of π/2 against the 90-digit π, then evaluated with Taylor series on |r| ≤ π/4.
- If |x| < 10⁻²⁰ (after any degree conversion), sin x = x, tan x = x and cos x = 1.

**Inverse functions**

| Function | Domain | Range |
|---|---|---|
| sin⁻¹ | [−1, 1], else `"Bad argument"` | [−90°, 90°] |
| cos⁻¹ | [−1, 1], else `"Bad argument"` | [0°, 180°] |
| tan⁻¹ | any x | (−90°, 90°) |

- The ranges are given in degrees; in radian mode they are the equivalent values in radians.
- sin⁻¹(±1) returns exactly ±π/2 (or ±90°).
- tan⁻¹ uses the reflection π/2 − atan(1/x) for |x| > 1, then halves the angle 4 times before its series.
- sin⁻¹(x) = atan(x/√(1−x²)), and cos⁻¹(x) = π/2 − sin⁻¹(x).

### 7.7 Gamma function (internal)

**Positive arguments (≥ 0.5)**

1. If the argument is below 60, shift it up to z ≥ 60 by adding an integer n.
2. Evaluate ln Γ(z) with the Stirling series using exact Bernoulli numbers B₂ … B₅₀.
3. Exponentiate, then divide by x(x+1)…(x+n−1).
4. Work at 49 significant digits before the final rounding.

**Arguments below 0.5** use the reflection formula Γ(x) = π / (sin(πx)·Γ(1−x)). The integer part of x is removed exactly before taking sin(πx), so sign and accuracy are preserved far from zero.

**Non-positive integers** give `"Infinite result"`.

### 7.8 Combinatorics (key 4)

**x!**

- Defined as **Γ(x + 1)**, so it accepts any real x, including fractions and negative non-integers. For example, `0.5! = √π/2 ≈ 0.8862269254527580136490837416705726` and `(−1.5)! = −2√π`.
- Integers from 0 to 1000 are computed as an exact integer product and then rounded to 34 digits.
- Negative integers give `"Infinite result"`.
- Very large x works as long as the result fits the exponent range, e.g. `1000000! ≈ 8.263931688331240062376646103172666E5565708`.

**ₙPᵣ and ₙCᵣ**

- n = y (level 2) and r = x (level 1): type n, ENTER, r, then choose the item.
- Both must be integers with 0 ≤ r ≤ n and n < 10¹⁵, otherwise `"Bad argument"`.
- **ₙPᵣ** = n!/(n−r)!. It is an exact falling product when r ≤ 5000, otherwise Γ(n+1)/Γ(n−r+1).
- **ₙCᵣ** = n!/(r!(n−r)!).
  - It uses k = min(r, n−r).
  - It is an exact integer computation when k ≤ 5000, otherwise a ratio of Gamma values.
  - Examples: `52 C 5 = 2598960`, and `10¹² C 3` is exact.

### 7.9 Number entry parsing

- The entry grammar is `-?digits*(.digits*)?(E-?digits*)?`, with at least one mantissa digit, except that `E…` alone means `1E…`.
- `-`, `.` alone and other malformed text are `"Invalid entry"`.
- An exponent with more than 15 significant digits is `"Overflow"`, or `"Underflow"` if it is negative.
- The parsed value is rounded to 34 significant digits.

### 7.10 Rounding clean-up (context menu `→`)

The clean-up targets accumulated rounding noise, such as `0.30000000000000000000000000000004` or `2.999999999999999999999999999999998`.

- Look at the digit string of the value's mantissa (canonical, so no trailing zeros) for the **first run of 12 or more consecutive `0`s or `9`s**.
- **A run of zeros**: cut the digits at the start of the run. A zero run always has non-zero digits after it, because trailing zeros are stripped.
- **A run of nines**: cut there and add one unit in the last kept digit, rounding up with carry. A run at the very start (e.g. `999999999999…`) rounds up to the next power of ten.
- If there is no such run, no `→` item is offered.

---

## 8. Number display

### 8.1 Canonical text format

This format is used for copying, for the ← (edit) key, and as the basis of the stack display. It shows at most *sig* significant digits (34 for full precision); let X be the decimal exponent of the leading digit.

- **Plain notation** if −5 ≤ X < sig, e.g. `123.45`, `0.00012`, or `1000000` (zeros are padded to the right of integers).
- **Scientific notation** otherwise: `d.dddE±X` with no `+` sign, e.g. `1.5E40`, `-2E-7`, `6.02214076E23`.
- A negative value has a leading `-`. Zero is `0`.
- No digit grouping, and no trailing zeros after the decimal point.

### 8.2 Fitting values into the stack display

**Available width**

- The number of characters that fit, *maxChars*, is computed from the stack area's inner width and the measured width of one monospace digit.
- When level labels are shown, their width is subtracted (the label column plus one gap character).
- maxChars is never below 6. It is recomputed on resize and once web fonts have loaded.

**Rules**, in order:

1. If the full 34-digit text fits, show it.
2. If it is plain notation containing a decimal point, and the point is not further right than position maxChars − 2: show the first maxChars − 1 characters (**cut, not rounded**) followed by a dimmed `…`. For example, `1.0000000000000000000001` in a narrow column shows as `1.000000000…`.
3. Otherwise switch to scientific notation `d.ddd…E±X`. If the mantissa does not fit, cut it (keeping at least 3 characters, e.g. `1.2`), add a dimmed `…`, and keep the full exponent: `1.234567…E40`.

The `…` always means "more digits are stored than shown". The stored value is never changed by the display.

---

## 9. Messages

| Text | Type | When |
|---|---|---|
| `Too few arguments` | error | function needs more stack values; ← on empty stack and entry |
| `Invalid entry` | error | entry cannot be parsed |
| `Overflow` | error | result or entered exponent too large; any internal range error |
| `Underflow` | error | entered negative exponent has more than 15 digits |
| `Divide by zero` | error | x/0, 1/0, MOD 0, 0 to a negative power |
| `Bad argument` | error | outside domain (√ or ln of negative, sin⁻¹(2), trig of \|x\| ≥ 1e60, bad nPr/nCr arguments, …) |
| `Infinite result` | error | tan(90°), Γ / factorial at a pole |
| `Stack empty` | error | STO with nothing to store |
| `Undo unavailable` | error | UNDO with no undo state and no entry |
| `Register A is empty` | error | RCL of an empty register (A/B/C/X/Y/Z) |
| `Invalid paste` | error | clipboard text is not a number (or would make an invalid entry) |
| `Clipboard not accessible` | error | clipboard read refused |
| `Copy failed` | error | both copy methods failed |
| `Stored in A` | info | successful STO |
| `Copied <text>` | info | successful copy |

---

## 10. Persistence

The full state is saved to `localStorage` under the key **`jcalc.state`** after every change and restored on load.

```json
{
  "s": [["<mantissa as decimal string>", <exponent>], ...],
  "e": "<entry string>",
  "deg": true,
  "levels": true,
  "u": [["<mantissa>", <exponent>], ...] or null,
  "r": { "A": ["<mantissa>", <exponent>], ... }
}
```

- `s` lists the stack from top to level 1.
- `u` is the undo state in the same form as `s`, or null when undo is unavailable.
- `r` holds only the filled registers.
- **Defaults**: empty stack, empty entry, degree mode, level labels on, no registers.
- All storage access is wrapped in try/catch. Storage may be unavailable (private mode, `data:` URLs), and the app must work normally without it. On a corrupt saved state, start with an empty stack and entry.
- Menus, highlights and messages are not persisted.

---

## 11. Implementation notes

These are not user-visible, but recreating the app is easier with them.

**File structure**

- One HTML file containing:
  - inline CSS;
  - a math script (the decimal library: representation, arithmetic, transcendental functions, formatting, parsing);
  - a UI script (state, keys, menus, rendering, persistence, input).

**Keys**

- Keys are generated from a data table. Each entry has: id, main label, optional style class, optional hint text, a tap function, and an optional menu.
- A menu is either a static array of rows of `[labelHTML, function, optionalClass]`, or a function that builds those rows when the menu opens. The STO, RCL, MODE and STACK menus depend on the current state, so they use the function form.

**Stack functions**

- Stack operations are built with a helper `op(n, f)` that does three things:
  1. commits the entry;
  2. checks the stack depth;
  3. calls `f` with the top n values (level n first, level 1 last) and replaces them with the returned array, catching errors as messages.
- Constants use n = 0 and return one value. SWAP returns `[x, y]`.

**Input handling**

- Use Pointer Events for all input, with `setPointerCapture` on key presses.
- Find the item under the finger with `document.elementFromPoint`.
- A full-screen transparent overlay behind an open sticky menu catches the "tap outside to close" press.

**Rendering**

- Re-render the whole display after every state change, then save.

---

## 12. Installable offline web app

Files served next to `index.html` (all paths relative, so the app works under a sub-path such as `/jCALC/`):

| File | Purpose |
|---|---|
| `manifest.json` | Web app manifest: name `jCALC`, `start_url`/`scope` `./`, `display: standalone`, portrait, background and theme color `#121418`, icons 192 and 512. |
| `sw.js` | Service worker that makes the app work offline. |
| `icon.svg` | Icon source (1024×1024, full-bleed square, no rounded corners) and browser favicon. |
| `icon-180.png` | iOS Home Screen icon (`apple-touch-icon`). Opaque, square corners. |
| `icon-192.png`, `icon-512.png` | Manifest icons. |

**Icon**: a dark display panel with three right-aligned stack rows (level 1 brightest and longest) above a wide orange ENTER key with a return arrow, using the app's dark-theme colors. No text. The PNGs are rendered from `icon.svg`.

**Page**: `index.html` links the manifest, `apple-touch-icon` and SVG favicon in `<head>`, and registers `sw.js` at the end of the UI script, only when served over http(s) (registration errors are ignored).

**Service worker**

- On install it pre-caches `./`, `index.html`, the manifest and the PNG icons in a cache named `jcalc-<VERSION>`, bypassing the HTTP cache. On activation it deletes other `jcalc-*` caches and takes control of open pages.
- Same-origin GET requests use **stale-while-revalidate**: answer from the cache at once, and refetch in the background (`cache: 'no-cache'`) to refresh the cache. Every page navigation, whatever its query string, is served the cached `./`.
- So a newly published `index.html` is picked up on the launch after the next online start; `VERSION` only needs a bump when the list of pre-cached files changes.
- Without a cached copy and without network, it returns a plain `Offline` (503) response.
