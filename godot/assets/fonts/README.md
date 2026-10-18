# Font assets — source and licence manifest

## `NotoSansSC-VF.ttf`

| Field | Value |
| --- | --- |
| Family | Noto Sans SC (variable, `wght` axis) |
| Upstream | <https://github.com/google/fonts/tree/main/ofl/notosanssc> |
| Fetched from | `https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf` |
| Retrieved | 2026-10-18 |
| Size | 17,772,300 bytes |
| SHA256 | `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da` |
| Licence | SIL Open Font License 1.1 — see `OFL.txt` in this directory |

Renamed from `NotoSansSC[wght].ttf` to `NotoSansSC-VF.ttf` so the bracket
characters never have to be escaped in `res://` paths.

**Why this font and not a system font.** The macOS system Chinese faces
(`PingFang SC`, `STHeiti`, `Arial Unicode`) are proprietary and cannot be
redistributed with this repository. Noto Sans SC is OFL-1.1, so it can be
committed and shipped inside exported builds, and it renders identically on
desktop and Web. It is a variable font; the default instance (weight 400) is
used by `res://ui/app_theme.tres`.

No other font is currently bundled. Adding one requires a row in this table.
