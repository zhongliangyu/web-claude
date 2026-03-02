"""
WebClaude 后端

提供 SSE 流式输出 Claude Code 的完整内容
"""

import os
import asyncio
import json
import subprocess
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn

# 配置
CLAUDE_CODE_PATH = os.getenv("CLAUDE_CODE_PATH", "claude")
WORKSPACE_PATH = os.getenv("WORKSPACE_PATH", str(Path.home() / "projects"))

app = FastAPI(title="WebClaude", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def stream_claude_output(message: str, workspace: str = WORKSPACE_PATH, claude_path: str = CLAUDE_CODE_PATH) -> AsyncGenerator[str, None]:
    """
    流式调用 Claude Code，输出 SSE 事件

    事件类型：
    - thinking: 思考过程
    - tool: 工具调用
    - output: 最终输出
    - error: 错误
    - done: 完成
    """
    print(f"📨 收到请求: {message[:50]}...")

    workdir = workspace.replace("~", str(Path.home()))
    claude_path = claude_path

    # 确保 workdir 存在
    Path(workdir).mkdir(parents=True, exist_ok=True)

    cmd = [claude_path, "-p", message]

    try:
        # 清除 CLAUDECODE 环境变量，避免嵌套会话
        env = {**os.environ, "CLAUDE_COLOR": "false"}
        # 确保移除 CLAUDECODE 和其他 Claude 环境变量
        for key in list(env.keys()):
            if "CLAUDE" in key.upper():
                del env[key]

        print(f"🔧 启动命令: {cmd}")
        print(f"🔧 工作目录: {workdir}")
        print(f"🔧 CLAUDECODE 已清除: {'CLAUDECODE' not in env}")

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=workdir,
            env=env
        )

        buffer = ""
        thinking_mode = False
        tool_mode = False
        output_mode = True

        while True:
            if proc.poll() is not None:
                break

            line = proc.stdout.readline()
            if not line:
                continue

            line = line.rstrip()

            # 检测 thinking 模式（Claude 的思考标记）
            if "<thinking>" in line:
                thinking_mode = True
                output_mode = False
                continue
            elif "</thinking>" in line:
                thinking_mode = False
                output_mode = True
                continue

            # 检测工具调用（简化检测）
            if "Tool Calls:" in line or "Calling:" in line:
                tool_mode = True
            elif line and not line.startswith(" ") and tool_mode:
                tool_mode = False

            # 分类发送事件
            if thinking_mode:
                yield f"event: thinking\ndata: {json.dumps({'content': line})}\n\n"
            elif tool_mode:
                yield f"event: tool\ndata: {json.dumps({'content': line})}\n\n"
            else:
                yield f"event: output\ndata: {json.dumps({'content': line})}\n\n"

        # 发送完成事件
        yield "event: done\ndata: {}\n\n"

    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        yield "event: done\ndata: {}\n\n"


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}


@app.post("/chat")
async def chat(req: dict):
    """
    聊天接口 (SSE 流式输出)
    """
    message = req.get("message", "")
    workspace = req.get("workspace", WORKSPACE_PATH)
    claude_path = req.get("claude_path", CLAUDE_CODE_PATH)

    return StreamingResponse(
        stream_claude_output(message, workspace, claude_path),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
