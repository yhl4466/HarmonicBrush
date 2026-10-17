# 谐波画笔 · 更新站点

这个目录可以直接上传到任意静态托管：

- **GitHub Pages**：把 `site` 的内容推到仓库，Settings → Pages → 选分支/根目录。
- **Netlify Drop**：打开 https://app.netlify.com/drop ，把整个 `site` 文件夹拖进去。
- **Gitee Pages / 对象存储 / 自己的服务器**：把 `site` 设为静态根目录即可。

## exe 太大怎么办

GitHub 网页上传单文件上限 25MB，68MB 的 exe 放不进仓库。做法：

1. 仓库的 **Releases → Draft a new release**，tag 用 `v1.0.0`，把 exe 作为附件上传并 Publish。
2. 附件地址形如 `https://github.com/<user>/<repo>/releases/download/v1.0.0/https://github.com/yhl4466/HarmonicBrush/releases/download/v1.0.0/HarmonicBrush-1.0.0.exe`，填进 `version.json` 的 `exe`。
3. Pages 里只放网页 + `version.json` + APK（约 4MB）。

App 会以 `version.json` 所在站点为基准解析相对 `apk`；`exe` 是绝对 URL 时直接打开 Release 下载。

## 跨机器更新

把设置 → 版本与更新 → 更新源填成站点的 `version.json` 地址；或在打包前把 `src/app.js` 的 `UPDATE_DEFAULT` 改成它。

当前版本：v1.0.0（2026-10-17）。
