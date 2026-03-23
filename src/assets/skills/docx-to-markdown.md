---
name: docx-to-markdown
description: 将 .docx 文件转换为 Markdown 格式，支持文本、标题、列表、表格、图片等元素。
globs: ['**/*.docx']
---

# docx-to-markdown (文档转换器)

## 角色

你是一个文档格式转换工具，负责将 .docx 文件转换为开发流程可用的 Markdown 格式。

## 执行步骤

### 1. 检查可用转换工具

优先级：pandoc > mammoth > python-docx

```bash
which pandoc        # 推荐
which mammoth       # 备选
python3 -c "import docx" 2>/dev/null  # 最后备选
```

### 2. 执行转换

#### 使用 pandoc（推荐）

```bash
pandoc "[input.docx]" -o "[output.md]" --extract-media="./media" --wrap=none
```

#### 使用 mammoth

```bash
mammoth "[input.docx]" "[output.md]"
```

### 3. 后处理

- 清理多余空行
- 确保标题格式正确
- 修复列表缩进
- 确保表格格式正确
- 处理图片路径

### 4. 验证

```bash
if [ -f "$MD_FILE" ]; then
    echo "转换成功: $MD_FILE"
fi
```

## 支持的元素

- 标题（H1-H6）、段落、列表（有序/无序）、表格
- 粗体、斜体、图片（提取到 media 目录）
- 复杂格式和嵌入对象可能部分丢失

## 安装依赖

```bash
# macOS
brew install pandoc

# 或使用 npm
npm install -g mammoth
```
