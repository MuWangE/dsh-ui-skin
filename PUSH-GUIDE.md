# 推送与发布指南

> 这份写给维护者：从零到把仓库推上 GitHub、以及之后日常怎么提交。
> 前提：仓库已初始化，`origin` 指向 `git@github.com:<账号>/dsh-ui-skin.git`。

## 0. 当前形态

| 项 | 值 |
|---|---|
| 分支 | `master`（发布历史）；本地另有 `archive` 分支存着改造前的完整历史，**不要推** |
| tag | `v0.1.0` |
| 私钥 | `~/.ssh/id_ed25519` |
| 公钥 | `~/.ssh/id_ed25519.pub` |
| 发布树里不应出现 | 任何本地绝对路径（见 §6 自检） |

## 1. 首次：加 SSH 公钥

1. 登录 GitHub → 右上角头像 → **Settings**
2. 左栏 **SSH and GPG keys** → **New SSH key**
3. Title 随便填；Key type 选 `Authentication Key`
4. 把 `~/.ssh/id_ed25519.pub` 的内容整行粘进去 → **Add SSH key**

验证：

```bash
ssh -T git@github.com
# 成功：Hi <账号>! You've successfully authenticated, but GitHub does not provide shell access.
```

## 2. 首次：建空仓库

GitHub → **+** → **New repository**：

- 名字与 `origin` 里的仓库名一致
- **不要勾** Add a README / .gitignore / license —— 勾了会产生初始提交，push 时要 `--allow-unrelated-histories`

## 3. 首次：推送

```bash
cd <repo>
git push -u origin master --tags
```

只推 `master` 和 tags。**`archive` 分支留在本地**（它带着改造前的历史与本地路径）。

## 4. 验证

```bash
git remote -v                 # 两条都是 ssh
git log --oneline -1          # 发布提交
git ls-remote --tags origin   # 能看到 v0.1.0
```

GitHub 页面上：提交只有发布那一条（或几条）、文件数对得上、Tags 里有 `v0.1.0`、README 可读。

## 5. 日常提交

```bash
cd <repo>

# 1) 跑全套（任一项红就别提交）
node tests/check-tokens.mjs && node tests/check-contrast.mjs && node tests/check-selectors.mjs \
  && node tests/client-smoke.mjs && node tests/skin-conflict.mjs && node tests/check-input-guard.mjs \
  && node tests/check-motion.mjs && node tests/check-skins.mjs && node tests/check-layout.mjs \
  && node tests/check-structure.mjs && node tests/check-config.mjs && node tests/check-skin-manifest.mjs

# 2) 看改了什么
git status
git diff

# 3) 提交
git add -A
git commit -m "一句话说清改了什么"

# 4) 推
git push
```

**发版**：

```bash
git tag -a v0.1.1 -m "0.1.1：一句话"
git push --tags
```

## 6. 提交前自检：别把本地路径带出去

```bash
git grep -n -e 'C:\\Users\\' -e '/Users/' -e '鱼工坊' -- '*.md' '*.js' '*.mjs' '*.json'
```

有输出就先把路径换成占位符（`<repo>` / `$DSH_HOME` / `<DSH 安装目录>`）。

## 7. 常见报错

| 报错 | 含义 | 处理 |
|---|---|---|
| `Permission denied (publickey)` | key 没加上，或加到了别的账号 | 重贴公钥；确认登录账号与 `origin` 里的账号一致 |
| `ERROR: Repository not found` | 仓库名不对或没建 | 对照 `origin` 与 GitHub 上的名字 |
| `Host key verification failed` | 本机不认 github.com | `ssh-keyscan github.com >> ~/.ssh/known_hosts` |
| `Support for password authentication was removed` | 地址用成了 https | `git remote set-url origin git@github.com:<账号>/dsh-ui-skin.git` |
| `failed to push some refs ... (fetch first)` | 建仓库时勾了 README | `git pull --allow-unrelated-histories` 后重推，或删仓库重建 |

## 8. 网络注意

如果 `github.com:443` 不通（某些网络环境），`https://` 克隆和推送都会失败；`ssh`（22 端口）
通常是另一条链路，值得先试：

```bash
Test-NetConnection github.com -Port 22   # Windows PowerShell
nc -vz github.com 22                     # macOS / Linux
```
