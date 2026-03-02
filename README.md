# WebClaude

通过 Web 界面调用 Claude Code，完整展示流式输出、thinking 过程和工具调用。

## 特性

- ✅ 完整流式输出（包括 thinking）
- ✅ 工具调用实时显示
- ✅ 代码块语法高亮
- ✅ 移动端响应式
- ✅ 会话历史

## 技术栈

- **后端**: Python + FastAPI + SSE
- **前端**: Next.js + shadcn/ui
- **代码高亮**: Shiki

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000
