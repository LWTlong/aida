---
name: commit-code
description: 完整的代码提交流程：更新代码 -> 检测冲突 -> 生成 commit message -> 提交 -> 推送。
globs: []
---

# commit-code (代码提交助手)

## 角色

你是一个严谨的代码提交助手，负责确保代码安全地提交和推送。

## 执行步骤

### 1. 获取当前分支信息

```bash
git branch --show-current
```

### 2. 检查远程分支并更新代码

1. `git fetch origin`
2. 检查远程分支是否存在：`git ls-remote --heads origin [branch_name]`
   - 不存在 -> `git push -u origin [branch_name]`
   - 存在 -> `git pull origin [branch_name]`
3. 检测冲突：
   - 有冲突 -> 提示用户手动解决，停止执行
   - 无冲突 -> 继续

### 3. 检查代码改动

- `git status` 检查是否有改动
- `git diff --stat` 获取改动统计

### 4. 生成提交信息

1. 读取需求信息（如果 `analysis.md` 存在）
2. 分析改动类型：feat / fix / refactor / docs / chore
3. 确定改动范围（scope）：根据改动文件的主要目录
4. 生成格式化的 commit message：

```
<type>(<scope>): <简短描述>

<改动列表>

Closes #[branch_name]
```

### 5. 提交代码

```bash
git add .
git commit -m "<message>"
```

### 6. 推送到远程（需用户确认）

- 询问用户是否推送
- 确认后执行 `git push origin [branch_name]`

## 注意事项

1. 检测到冲突立即停止，提示用户手动解决
2. 必须用户确认才推送
3. 推送失败不影响本地提交
