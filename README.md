<div align="center">

<img src="icon.svg" width="88" alt="文件引用图标" />

# 文件引用 · File mention

**为 DeepSeek Harness 右侧目录树面板文件，以及文件里选中的内容，提供可一键引用到输入框的功能。**

[![DSH Web](https://img.shields.io/badge/DSH-Web%20%26%20Desktop-4D6BFE?style=flat-square)](#兼容性)
[![介绍页](https://img.shields.io/badge/介绍页-tinxyoo.github.io-4D6BFE?style=flat-square)](https://tinxyoo.github.io/dsh-file-mention/)
[![Stars](https://img.shields.io/github/stars/Tinxyoo/dsh-file-mention?style=flat-square&color=4D6BFE)](https://github.com/Tinxyoo/dsh-file-mention/stargazers)
[![无构建](https://img.shields.io/badge/build-none-2ea44f?style=flat-square)](#开发)

[在线介绍页](https://tinxyoo.github.io/dsh-file-mention/) · [安装](#安装) · [使用](#使用) · [兼容性](#兼容性) · [工作原理](#工作原理)

</div>

---

## 这是什么

一个 DSH Web / Desktop 的界面插件，解决两件小事：

| 场景 | 操作 | 结果 |
| --- | --- | --- |
| 想让模型看某个文件 | 右侧文件树里**右键文件** → **添加到输入框** | 输入框插入原子引用 chip，点击可直接预览 |
| 想让模型看文件里的某段内容 | 文件预览里**选中内容** → 点浮动的 **引用到输入框** | 输入框插入一张引用卡片 |

引用走的是和 `@` 文件选择器同一套语法：路径相对工作区根目录，含空格时写成 `@"my file.md"`。

> [!NOTE]
> 插入的是输入框的**原子节点**，不是逐字文本：光标移到 chip / 卡片旁边，退格一次就整块删除。

## 安装

前提：运行的是 DSH 的 **Web / Desktop** 界面（这是 Client 插件），profile 可写；Desktop 自带 pnpm。

### 界面安装（推荐）

1. 把本仓库克隆或下载到本机（安装后不要移动/删除该目录，profile 里是指向它的 `link:` 引用）
2. 左侧栏 → **插件（Plugins）** → **添加插件**
3. 填仓库地址或本地绝对路径：

   ```text
   https://github.com/Tinxyoo/dsh-file-mention
   ```

   或

   ```text
   /Users/you/Downloads/file-mention
   ```

4. **安装** → 完成后点 **Enable now**（若提示需要重启，重启 DSH）

### 让 agent 安装

把目录放好后，对 agent 说「安装 `<绝对路径>` 这个插件」，它会调用 `plugin_manager install_bundle`。

## 使用

### 引用文件

1. 打开右侧文件树（`files` 页，或文件预览旁的文件树）
2. 右键任意文件 → **添加到输入框**
3. 输入框出现一个文件 chip；点击可打开预览，退格一次整块删除

### 引用内容

1. 在右侧文件预览（Markdown / 代码 / 纯文本）里选中一段内容
2. 选区上方出现 **引用到输入框**，点击
3. 输入框插入一张引用卡片，可以紧接着写你的问题

> [!TIP]
> 引用卡片本身就是一块内容；从末尾退格时，第一次会先删掉自动补的分隔空格，第二次整张卡片消失。

## 兼容性

| 项 | 说明 |
| --- | --- |
| DSH 版本 | 面向 `0.2.2-rc.1` 一代的 Web 组合开发 |
| 平台 | Web / Desktop（Client 插件，纯 CLI 会话看不到效果） |
| 内容引用范围 | Markdown、代码、纯文本预览；PDF / Office 文本层暂未接入 |
| 构建 | 无，`client.js` 直接作为浏览器端模块加载 |
| 依赖 | 无第三方运行时依赖 |

插件依赖以下宿主接缝；宿主升级后若这些接缝变化，可能需要小改 `client.js`：

- `slash/input-insert-reference`：输入框原子引用 chip 的插入通道
- `sidebar.right.tab.document.actions` 槽位：预览页上的选区监听挂载点
- `shell.overlay` 槽位：浮动引用按钮
- 预览内容区域标记 `[data-textpreview-content]`

## 工作原理

| 能力 | 实现 |
| --- | --- |
| 右键菜单 | `ctx.contextMenus.register({ target: 'file' })`，动作执行时向会话作用域派发 `slash/input-insert-reference` |
| 原子引用 | `ReferenceChipNode`（`source: reference`、`appearance: file`、`clipboardText: @path`），与 `@` 选择器一致 |
| 选区监听 | 在预览工具栏挂一个只监听、不渲染的组件，限定在 `[data-textpreview-content]` 内 |
| 浮动按钮 | 注册到 `shell.overlay`，位置跟随选区，点击调用 `inputActions.insertQuote()` |
| 整块删除 | 引用 chip 与引用卡片都是输入框的原子节点，退格在边缘一次删除 |

## 项目结构

```text
.
├── client.js            # 全部界面行为：右键菜单、选区监听、浮动按钮、chip / 引用卡片插入
├── index.js             # Host 半侧（空实现）
├── cordis.patch.yml     # 向 profile 插入一行插件
├── package.json         # bundle 清单：dsh.bundle.patch、dsh.client
├── icon.svg             # 插件图标
├── locale/
│   ├── en.json          # 插件管理页标题 / 描述
│   └── zh.json
├── docs/
│   └── index.html       # GitHub Pages 介绍页
└── README.md
```

## 开发

没有构建步骤，改完 `client.js` 后：

- 若客户端 HMR 已开启，插件会自动重载
- 否则刷新页面；仍不生效时重启 DSH

调试时可以配合 `cordis_inspect_query` 查看槽位注册是否生效：

```text
Slots.listSubTree → sidebar.right.tab.document.actions / shell.overlay
```

## 卸载

**插件** 页里关闭该 bundle，或移除它。关闭后插件对该 profile 下所有会话立即失效。

## 许可证

[MIT](LICENSE) © Tinxyoo

## 开放插件市场徽章

[![开放插件市场](https://img.shields.io/endpoint?url=https%3A%2F%2Fdshopen.org%2Fbadge%2Fdsh-file-mention.json)](https://dshopen.org/zh/plugins/dsh-file-mention/)

## 已知限制

- 内容引用只覆盖文本类预览；PDF / Office 需要另一套文本层选择机制
- 选区浮层依赖预览内容区域的 DOM 标记，宿主改版可能失效
- 本地目录安装是链接引用：源目录被删或移动，插件会失效

---

<div align="center">

作者 [Tinxyoo](https://github.com/Tinxyoo) · [Dremo@qq.com](mailto:Dremo@qq.com) · 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web 界面而做

</div>
