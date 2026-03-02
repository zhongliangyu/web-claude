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
from pydantic import BaseModel
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


class ChatRequest(BaseModel):
    """聊天请求"""
    message: str
    workspace: str = WORKSPACE_PATH
    claude_path: str = CLAUDE_CODE_PATH


async def stream_claude_output(req: ChatRequest) -> AsyncGenerator[str, None]:
    """
    流式调用 Claude Code，输出 SSE 事件

    事件类型：
    - thinking: 思考过程
    - tool: 工具调用
    - output: 最终输出
    - error: 错误
    - done: 完成
    """
    print(f"📨 收到请求: {req.message[:50]}...")

    workdir = req.workspace.replace("~", str(Path.home()))
    claude_path = req.claude_path

    # 确保 workdir 存在
    Path(workdir).mkdir(parents=True, exist_ok=True)

    cmd = [claude_path, "-p", req.message]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd=workdir,
            env={**os.environ, "CLAUDE_COLOR": "false"}
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
async def chat(req: ChatRequest):
    """
    聊天接口 (SSE 流式输出)
    """
    return StreamingResponse(
        stream_claude_output(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
