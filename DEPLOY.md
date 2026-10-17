# 部署（Cloudflare Pages 为主）

页面是纯静态，任何静态托管都能放。当前默认更新源是 **Cloudflare Pages**，GitHub Pages 作为备用。

## 目录

`site2/` 是可直接上传的成品：

- `index.html` + `src/` + `assets/`：网页版
- `version.json`：更新清单
- `HarmonicBrush-1.0.0-debug.apk`：Android 包
- `download.html`、`screenshots/`、`README.md`、`.nojekyll`
- 68MB 的 exe 不放静态站，走 GitHub Releases

## Cloudflare Pages（推荐，免备案）

1. 打开 <https://pages.cloudflare.com> → **Create a project** → **Direct Upload**（或 Workers & Pages → Create → Pages → Upload assets）。
2. 项目名填 **`harmonic-brush`**，这样地址正好是 `https://harmonic-brush.pages.dev/`。
3. 把 `site2/` 文件夹拖进去，**Deploy site**。
4. 完成后：

   - 站点：`https://harmonic-brush.pages.dev/`
   - 更新清单：`https://harmonic-brush.pages.dev/version.json`
   - 下载页：`https://harmonic-brush.pages.dev/download.html`

单文件上限 25MB：APK 3.9MB 没问题；exe 68MB 不要放 Pages。

## GitHub Pages（备用）

1. 把 `site2/` 内容推到仓库根目录，Settings → Pages → Deploy from a branch → `main` / `/ (root)`。
2. 站点：`https://yhl4466.github.io/HarmonicBrush/`；清单 `.../version.json`。
3. 这个地址已写进 `UPDATE_FALLBACK`，Cloudflare 连不上时 App 会自动重试它。

## exe 走 GitHub Releases

1. 仓库 → Releases → Draft a new release，tag `v1.0.0`，上传 `release/HarmonicBrush-1.0.0.exe`，Publish。
2. 附件地址：`https://github.com/yhl4466/HarmonicBrush/releases/download/v1.0.0/HarmonicBrush-1.0.0.exe`
3. 已写进 `version.json` 的 `exe`；下载时直接打开这个地址。

## 更新源

- 默认主源：`https://harmonic-brush.pages.dev/version.json`（`src/app.js` 的 `UPDATE_DEFAULT`）
- 备用源：`https://yhl4466.github.io/HarmonicBrush/version.json`（`UPDATE_FALLBACK`）
- 想换地址：`node tools/set-update-source.mjs https://<新地址>/version.json`，再重新打包。
