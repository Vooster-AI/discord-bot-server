#!/bin/bash

echo "🚀 Discord 포럼 동기화 시스템 시작"
echo "=================================="

# 서버를 백그라운드에서 실행
echo "📡 Express.js 서버 시작 중..."
npm run server &
SERVER_PID=$!

# 3초 대기 (서버 시작 시간)
sleep 3

# Discord 봇 실행
echo "🤖 Discord 봇 시작 중..."
npm run dev &
BOT_PID=$!

echo "✅ 시스템 시작 완료!"
echo "📡 서버 PID: $SERVER_PID"
echo "🤖 봇 PID: $BOT_PID"
echo ""
echo "중지하려면 Ctrl+C를 누르세요..."

# 종료 신호 처리
trap 'echo "🛑 시스템 종료 중..."; kill $SERVER_PID $BOT_PID; exit' INT

# 프로세스가 살아있는 동안 대기
wait