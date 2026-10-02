import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Swords,
  Bot,
  User,
  RotateCcw,
  Sparkles,
  Flame,
  Shield,
  HelpCircle,
  Award,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  botWins: number;
  botLosses: number;
  lastPlayed: number;
}

export default function CaroDashboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeGamesCount, setActiveGamesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Web Mini-Arena State
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'master'>('hard');
  const [board, setBoard] = useState<Array<Array<'X' | 'O' | null>>>(() =>
    Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null))
  );
  const [currentTurn, setCurrentTurn] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null);
  const [winningCoords, setWinningCoords] = useState<Array<{ r: number; c: number }>>([]);
  const [movesCount, setMovesCount] = useState<number>(0);
  const [botThinking, setBotThinking] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/caro/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLeaderboard(data.leaderboard || []);
          setActiveGamesCount(data.activeGamesCount || 0);
        }
      }
    } catch (err) {
      console.error('Lỗi tải BXH Caro:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Kiểm tra thắng cờ client-side cho Web Mini-Arena
  const checkWin = (b: Array<Array<'X' | 'O' | null>>, targetWin: number = 4) => {
    const size = b.length;
    const directions = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 },
    ];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const piece = b[r][c];
        if (!piece) continue;

        for (const { dr, dc } of directions) {
          let win = true;
          const coords: Array<{ r: number; c: number }> = [];

          for (let step = 0; step < targetWin; step++) {
            const nr = r + dr * step;
            const nc = c + dc * step;

            if (nr < 0 || nr >= size || nc < 0 || nc >= size || b[nr][nc] !== piece) {
              win = false;
              break;
            }
            coords.push({ r: nr, c: nc });
          }

          if (win) {
            return { winner: piece, coords };
          }
        }
      }
    }
    return { winner: null, coords: [] };
  };

  const isFull = (b: Array<Array<'X' | 'O' | null>>) => {
    return b.every(row => row.every(cell => cell !== null));
  };

  // Người chơi click vào ô cờ
  const handleCellClick = async (r: number, c: number) => {
    if (board[r][c] !== null || winner !== null || botThinking || currentTurn !== 'X') return;

    const newBoard = board.map((row, ri) =>
      row.map((cell, ci) => (ri === r && ci === c ? 'X' : cell))
    );
    setBoard(newBoard);
    const newMoves = movesCount + 1;
    setMovesCount(newMoves);

    // Kiểm tra người chơi X có thắng không
    const winRes = checkWin(newBoard, 4);
    if (winRes.winner) {
      setWinner(winRes.winner);
      setWinningCoords(winRes.coords);
      return;
    }

    if (isFull(newBoard)) {
      setWinner('draw');
      return;
    }

    // Tới lượt Bot O
    setCurrentTurn('O');
    setBotThinking(true);

    try {
      const res = await fetch('/api/caro/bot-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: newBoard, botPiece: 'O', difficulty }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.move) {
          const { r: br, c: bc } = data.move;
          const botBoard = newBoard.map((row, ri) =>
            row.map((cell, ci) => (ri === br && ci === bc ? 'O' : cell))
          );
          setBoard(botBoard);
          setMovesCount(newMoves + 1);

          const botWinRes = checkWin(botBoard, 4);
          if (botWinRes.winner) {
            setWinner(botWinRes.winner);
            setWinningCoords(botWinRes.coords);
          } else if (isFull(botBoard)) {
            setWinner('draw');
          } else {
            setCurrentTurn('X');
          }
        }
      }
    } catch (err) {
      console.error('Lỗi tính nước bot:', err);
      setCurrentTurn('X');
    } finally {
      setBotThinking(false);
    }
  };

  const resetGame = () => {
    setBoard(Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null)));
    setCurrentTurn('X');
    setWinner(null);
    setWinningCoords([]);
    setMovesCount(0);
    setBotThinking(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const getRankBadge = (rating: number) => {
    if (rating >= 2000) return { title: 'Đại Kiện Tướng Vũ Trụ', badge: '👑🌟', color: 'text-amber-400 bg-amber-400/10 border-amber-400/30' };
    if (rating >= 1600) return { title: 'Đại Kiện Tướng', badge: '👑', color: 'text-red-400 bg-red-400/10 border-red-400/30' };
    if (rating >= 1400) return { title: 'Kiện Tướng', badge: '💎', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' };
    if (rating >= 1200) return { title: 'Cao Thủ', badge: '🔥', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' };
    if (rating >= 1050) return { title: 'Kỳ Thủ', badge: '⚔️', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' };
    return { title: 'Tập Sự', badge: '🌱', color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' };
  };

  return (
    <div className="bg-[#1E1F22] rounded-xl border border-blue-500/30 overflow-hidden mb-8 shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/20 p-4 border-b border-[#2B2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-inner">
            <Swords className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">
                Đấu Trường Cờ Caro (Blitz 5x5 & Bot AI)
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Interactive Engine
              </span>
            </div>
            <p className="text-xs text-[#949BA4]">
              Hệ thống thách đấu người chơi (PvP) & solo cùng Bot AI với 25 Discord Buttons tương tác trực tiếp
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeGamesCount > 0 && (
            <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{activeGamesCount} ván đang đấu</span>
            </span>
          )}
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2B2D31] hover:bg-[#35373C] text-gray-200 rounded-lg text-xs font-semibold transition border border-white/5 cursor-pointer disabled:opacity-50"
            title="Làm mới BXH"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Web Mini-Arena (5x5) */}
        <div className="lg:col-span-6 flex flex-col items-center bg-[#111214] p-4 sm:p-5 rounded-xl border border-[#2B2D31]">
          <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-[#2B2D31]">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Luyện tập trực tiếp với Bot AI</span>
            </div>
            {/* Difficulty Selector */}
            <div className="flex items-center space-x-1 bg-[#1E1F22] p-1 rounded-lg border border-[#2B2D31]">
              {(['easy', 'medium', 'hard', 'master'] as const).map(diff => (
                <button
                  key={diff}
                  onClick={() => {
                    setDifficulty(diff);
                    resetGame();
                  }}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded transition cursor-pointer capitalize ${
                    difficulty === diff
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {diff === 'easy' ? 'Dễ' : diff === 'medium' ? 'Vừa' : diff === 'hard' ? 'Khó' : 'Đại Sư'}
                </button>
              ))}
            </div>
          </div>

          {/* Status banner */}
          <div className="w-full mb-3 text-center">
            {winner ? (
              <div
                className={`py-2 px-3 rounded-lg text-xs font-bold border ${
                  winner === 'X'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : winner === 'O'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                }`}
              >
                {winner === 'X'
                  ? '🎉 Bạn đã chiến thắng SentinelBot!'
                  : winner === 'O'
                  ? '🤖 SentinelBot đã giành chiến thắng!'
                  : '🤝 Trận cờ bất phân thắng bại! (Hòa)'}
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-gray-300 px-2">
                <span className="flex items-center space-x-1.5">
                  <span className="font-semibold text-white">Lượt đi:</span>
                  {currentTurn === 'X' ? (
                    <span className="text-red-400 font-bold flex items-center gap-1">❌ Bạn (X)</span>
                  ) : (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      ⭕ Bot (O) {botThinking && <span className="animate-pulse">đang tính...</span>}
                    </span>
                  )}
                </span>
                <span className="text-[#949BA4]">Số nước: #{movesCount} (4 liên tiếp thắng)</span>
              </div>
            )}
          </div>

          {/* 5x5 Board Grid */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 p-2 bg-[#1E1F22] rounded-xl border border-[#2B2D31] shadow-inner">
            {board.map((row, r) =>
              row.map((cell, c) => {
                const isWinningCell = winningCoords.some(coord => coord.r === r && coord.c === c);
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => handleCellClick(r, c)}
                    disabled={cell !== null || winner !== null || botThinking || currentTurn !== 'X'}
                    className={`w-11 h-11 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center font-bold text-lg sm:text-2xl transition cursor-pointer select-none ${
                      isWinningCell
                        ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400 animate-pulse'
                        : cell === 'X'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : cell === 'O'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-[#2B2D31]/50 hover:bg-[#35373C] text-transparent hover:text-gray-500 border border-[#35373C]'
                    }`}
                  >
                    {cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '▫️'}
                  </button>
                );
              })
            )}
          </div>

          {/* Reset / rematch button */}
          <div className="w-full mt-4 flex items-center justify-between">
            <button
              onClick={resetGame}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#2B2D31] hover:bg-[#35373C] text-gray-200 rounded-lg text-xs font-semibold transition border border-white/5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Chơi ván mới</span>
            </button>
            <span className="text-[11px] text-[#949BA4]">Bấm nút trên bàn cờ để hạ quân</span>
          </div>
        </div>

        {/* Right Column: Server Leaderboard & Discord Commands */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          {/* Leaderboard Card */}
          <div className="bg-[#111214] p-4 rounded-xl border border-[#2B2D31] flex-1">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2B2D31]">
              <div className="flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-white">Bảng Vàng Cao Thủ Cờ Caro</h4>
              </div>
              <span className="text-[11px] text-[#949BA4]">{leaderboard.length} kỳ thủ</span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-gray-400">Đang tải bảng xếp hạng...</div>
            ) : leaderboard.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <Award className="w-8 h-8 mx-auto text-gray-500 mb-2 opacity-50" />
                Chưa có kỳ thủ nào ghi danh trên bảng xếp hạng!
                <div className="mt-1 text-[11px] text-gray-500">
                  Hãy vào Discord gõ <code className="text-blue-400">?caro bot</code> hoặc{' '}
                  <code className="text-blue-400">?caro @user</code> để mở màn!
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {leaderboard.slice(0, 10).map((player, idx) => {
                  const rankInfo = getRankBadge(player.rating);
                  const medals = ['🥇', '🥈', '🥉'];
                  const total = player.wins + player.losses + player.draws;
                  const winRate = total > 0 ? ((player.wins / total) * 100).toFixed(1) : '0';

                  return (
                    <div
                      key={player.id}
                      className="p-2.5 bg-[#1E1F22] rounded-lg border border-[#2B2D31] flex items-center justify-between hover:border-blue-500/30 transition text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className="font-bold text-sm w-5 text-center">
                          {medals[idx] || `#${idx + 1}`}
                        </span>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>{player.username}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${rankInfo.color}`}
                            >
                              {rankInfo.badge} {rankInfo.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#949BA4] flex items-center space-x-2 mt-0.5">
                            <span>Thắng: <strong className="text-emerald-400">{player.wins}</strong></span>
                            <span>•</span>
                            <span>Thua: <strong className="text-red-400">{player.losses}</strong></span>
                            <span>•</span>
                            <span>Tỉ lệ: <strong>{winRate}%</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-amber-400 text-sm">{player.rating} ELO</div>
                        {player.streak > 0 && (
                          <div className="text-[10px] text-orange-400 flex items-center justify-end gap-0.5">
                            <Flame className="w-3 h-3 text-orange-400" />
                            <span>Chuỗi {player.streak}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Discord Commands Reference Box */}
          <div className="bg-[#111214] p-4 rounded-xl border border-[#2B2D31]">
            <div className="flex items-center space-x-2 mb-2.5">
              <Zap className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Lệnh Discord Cờ Caro
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { cmd: '?caro bot', desc: 'Solo ngay với Bot AI thông minh' },
                { cmd: '?caro @user', desc: 'Thách đấu bạn bè trong server' },
                { cmd: '?caro stats', desc: 'Xem điểm ELO, Rank & hồ sơ' },
                { cmd: '?caro top', desc: 'Xem BXH Top 10 cao thủ' },
                { cmd: '?caro resign', desc: 'Xin đầu hàng ván cờ hiện tại' },
                { cmd: '/caro bot', desc: 'Slash command đấu cờ với Bot' },
              ].map(item => (
                <div
                  key={item.cmd}
                  onClick={() => copyToClipboard(item.cmd)}
                  className="bg-[#1E1F22] p-2 rounded-lg border border-[#2B2D31] hover:border-purple-500/30 transition flex items-center justify-between cursor-pointer group"
                  title="Nhấp để copy lệnh"
                >
                  <div>
                    <code className="text-blue-400 font-bold group-hover:text-purple-300">
                      {item.cmd}
                    </code>
                    <p className="text-[11px] text-[#949BA4] mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-[10px] text-gray-500 group-hover:text-gray-300 ml-2">
                    {copiedCmd === item.cmd ? 'Đã chép!' : 'Copy'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
