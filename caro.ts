import fs from 'fs';
import path from 'path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Message,
  ButtonInteraction,
  ChatInputCommandInteraction,
  User,
  GuildMember,
  PermissionsBitField,
  Client,
} from 'discord.js';

// Đường dẫn file lưu trữ bảng xếp hạng & thông số cờ Caro
const STATS_FILE = path.join(process.cwd(), 'caro_stats.json');

export interface CaroPlayerStats {
  id: string;
  username: string;
  rating: number; // Điểm ELO khởi đầu 1000
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  botWins: number;
  botLosses: number;
  lastPlayed: number;
}

export interface CaroGame {
  id: string; // Mã trận đấu duy nhất
  channelId: string;
  guildId: string;
  challengerId: string;
  targetId: string;
  playerX: { id: string; username: string; isBot: boolean };
  playerO: { id: string; username: string; isBot: boolean };
  isBotMatch: boolean;
  botDifficulty: 'easy' | 'medium' | 'hard' | 'master';
  boardSize: number; // 5
  winCondition: number; // 4 liên tiếp
  board: Array<Array<'X' | 'O' | null>>;
  currentTurn: 'X' | 'O';
  status: 'pending' | 'playing' | 'ended';
  winner?: 'X' | 'O' | 'draw';
  winningCoords?: Array<{ r: number; c: number }>;
  messageId?: string;
  createdAt: number;
  lastMoveAt: number;
  movesCount: number;
  expiresAt: number;
}

// Map lưu trữ các ván cờ đang hoạt động: gameId -> CaroGame
export const activeCaroGames = new Map<string, CaroGame>();
// Map ánh xạ userId -> gameId để tránh 1 người tham gia nhiều ván cùng lúc
export const userToGameMap = new Map<string, string>();
// Map lưu trữ lời mời đang chờ: gameId -> CaroGame
export const pendingCaroChallenges = new Map<string, CaroGame>();

// --- Quản lý dữ liệu Stats ---
let statsCache: Record<string, CaroPlayerStats> = {};

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, 'utf-8');
      statsCache = JSON.parse(raw);
    } else {
      statsCache = {};
    }
  } catch (err) {
    console.error('Lỗi khi đọc file caro_stats.json:', err);
    statsCache = {};
  }
}

function saveStats() {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(statsCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi khi lưu file caro_stats.json:', err);
  }
}

loadStats();

export function getPlayerStats(userId: string, username: string = 'Người chơi'): CaroPlayerStats {
  if (!statsCache[userId]) {
    statsCache[userId] = {
      id: userId,
      username,
      rating: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
      bestStreak: 0,
      botWins: 0,
      botLosses: 0,
      lastPlayed: Date.now(),
    };
    saveStats();
  } else if (username && username !== 'Người chơi') {
    statsCache[userId].username = username;
  }
  return statsCache[userId];
}

export function getAllLeaderboard(): CaroPlayerStats[] {
  return Object.values(statsCache)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins);
}

export function updateStatsMatchResult(
  playerXId: string,
  playerXName: string,
  playerOId: string,
  playerOName: string,
  isBotMatch: boolean,
  winner: 'X' | 'O' | 'draw'
) {
  const pX = getPlayerStats(playerXId, playerXName);
  pX.lastPlayed = Date.now();

  if (isBotMatch) {
    if (winner === 'X') {
      pX.wins += 1;
      pX.botWins += 1;
      pX.streak += 1;
      if (pX.streak > pX.bestStreak) pX.bestStreak = pX.streak;
      pX.rating += 15;
    } else if (winner === 'O') {
      pX.losses += 1;
      pX.botLosses += 1;
      pX.streak = 0;
      pX.rating = Math.max(100, pX.rating - 10);
    } else {
      pX.draws += 1;
      pX.rating += 2;
    }
  } else {
    const pO = getPlayerStats(playerOId, playerOName);
    pO.lastPlayed = Date.now();

    if (winner === 'X') {
      pX.wins += 1;
      pX.streak += 1;
      if (pX.streak > pX.bestStreak) pX.bestStreak = pX.streak;
      pX.rating += 25;

      pO.losses += 1;
      pO.streak = 0;
      pO.rating = Math.max(100, pO.rating - 18);
    } else if (winner === 'O') {
      pO.wins += 1;
      pO.streak += 1;
      if (pO.streak > pO.bestStreak) pO.bestStreak = pO.streak;
      pO.rating += 25;

      pX.losses += 1;
      pX.streak = 0;
      pX.rating = Math.max(100, pX.rating - 18);
    } else {
      pX.draws += 1;
      pO.draws += 1;
      pX.rating += 3;
      pO.rating += 3;
    }
  }

  saveStats();
}

export function getRankTier(rating: number): { title: string; badge: string; color: string } {
  if (rating >= 2000) return { title: 'Đại Kiện Tướng Vũ Trụ', badge: '👑🌟', color: '#ffb703' };
  if (rating >= 1600) return { title: 'Đại Kiện Tướng', badge: '👑', color: '#e63946' };
  if (rating >= 1400) return { title: 'Kiện Tướng', badge: '💎', color: '#7209b7' };
  if (rating >= 1200) return { title: 'Cao Thủ', badge: '🔥', color: '#4361ee' };
  if (rating >= 1050) return { title: 'Kỳ Thủ', badge: '⚔️', color: '#2a9d8f' };
  return { title: 'Tập Sự', badge: '🌱', color: '#90a4ae' };
}

// --- Thuật Toán Kiểm Tra Thắng Cờ (4 hoặc 5 liên tiếp trên bàn 5x5) ---
export function checkWinCondition(
  board: Array<Array<'X' | 'O' | null>>,
  targetWin: number = 4
): { winner: 'X' | 'O' | null; coords: Array<{ r: number; c: number }> } {
  const size = board.length;
  const directions = [
    { dr: 0, dc: 1 },  // Hàng ngang
    { dr: 1, dc: 0 },  // Cột dọc
    { dr: 1, dc: 1 },  // Đường chéo chính \
    { dr: 1, dc: -1 }, // Đường chéo phụ /
  ];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      for (const { dr, dc } of directions) {
        let win = true;
        const lineCoords: Array<{ r: number; c: number }> = [];

        for (let step = 0; step < targetWin; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;

          if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr][nc] !== piece) {
            win = false;
            break;
          }
          lineCoords.push({ r: nr, c: nc });
        }

        if (win) {
          return { winner: piece, coords: lineCoords };
        }
      }
    }
  }

  return { winner: null, coords: [] };
}

export function isBoardFull(board: Array<Array<'X' | 'O' | null>>): boolean {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

// --- AI Engine cho Bot (PvE) ---
export function getBotBestMove(
  board: Array<Array<'X' | 'O' | null>>,
  botPiece: 'X' | 'O' = 'O',
  difficulty: 'easy' | 'medium' | 'hard' | 'master' = 'hard'
): { r: number; c: number } {
  const humanPiece = botPiece === 'X' ? 'O' : 'X';
  const size = board.length;
  const emptyCells: Array<{ r: number; c: number }> = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === null) {
        emptyCells.push({ r, c });
      }
    }
  }

  if (emptyCells.length === 0) return { r: 0, c: 0 };

  // Dễ: 40% đi ngẫu nhiên
  if (difficulty === 'easy' && Math.random() < 0.45) {
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  // 1. Kiểm tra Bot có thể thắng ngay trong 1 nước không
  for (const cell of emptyCells) {
    board[cell.r][cell.c] = botPiece;
    const { winner } = checkWinCondition(board, 4);
    board[cell.r][cell.c] = null;
    if (winner === botPiece) {
      return cell;
    }
  }

  // 2. Kiểm tra đối thủ sắp thắng trong 1 nước để CHẶN
  for (const cell of emptyCells) {
    board[cell.r][cell.c] = humanPiece;
    const { winner } = checkWinCondition(board, 4);
    board[cell.r][cell.c] = null;
    if (winner === humanPiece) {
      return cell;
    }
  }

  // 3. Chặn nước 3 liên tiếp của đối thủ (đối với hard hoặc master)
  if (difficulty === 'hard' || difficulty === 'master') {
    for (const cell of emptyCells) {
      board[cell.r][cell.c] = humanPiece;
      const { winner } = checkWinCondition(board, 3);
      board[cell.r][cell.c] = null;
      if (winner === humanPiece) {
        // Nước này có thể chặn đối thủ tạo thành chuỗi 3
        if (Math.random() < 0.85) {
          return cell;
        }
      }
    }
  }

  // 4. Đánh giá Heuristic trọng số từng ô cờ
  let bestScore = -Infinity;
  let bestMoves: Array<{ r: number; c: number }> = [];

  for (const cell of emptyCells) {
    let score = 0;

    // Ưu tiên ô trung tâm bàn cờ (2, 2)
    if (cell.r === 2 && cell.c === 2) score += 25;
    // Ưu tiên vòng trong (1..3, 1..3)
    else if (cell.r >= 1 && cell.r <= 3 && cell.c >= 1 && cell.c <= 3) score += 12;

    // Tính điểm lân cận (gần quân cờ đã có)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = cell.r + dr;
        const nc = cell.c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (board[nr][nc] === botPiece) score += 6;
          if (board[nr][nc] === humanPiece) score += 5;
        }
      }
    }

    // Đánh giá thế tấn công (tạo chuỗi 2 hoặc 3)
    board[cell.r][cell.c] = botPiece;
    const res3Bot = checkWinCondition(board, 3);
    if (res3Bot.winner === botPiece) score += 30;
    const res2Bot = checkWinCondition(board, 2);
    if (res2Bot.winner === botPiece) score += 8;
    board[cell.r][cell.c] = null;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [cell];
    } else if (score === bestScore) {
      bestMoves.push(cell);
    }
  }

  if (bestMoves.length > 0) {
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

// --- Tạo Giao Diện Discord Component Cho Bàn Cờ ---
export function renderCaroComponents(game: CaroGame): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const size = game.boardSize;

  for (let r = 0; r < size; r++) {
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (let c = 0; c < size; c++) {
      const piece = game.board[r][c];
      const isWinningCell = game.winningCoords?.some(coord => coord.r === r && coord.c === c);

      const btn = new ButtonBuilder().setCustomId(`caro_cell_${game.id}_${r}_${c}`);

      if (piece === 'X') {
        btn.setLabel('❌')
          .setStyle(isWinningCell ? ButtonStyle.Primary : ButtonStyle.Danger)
          .setDisabled(true);
      } else if (piece === 'O') {
        btn.setLabel('⭕')
          .setStyle(isWinningCell ? ButtonStyle.Primary : ButtonStyle.Success)
          .setDisabled(true);
      } else {
        // Ô trống
        btn.setLabel('▫️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(game.status !== 'playing');
      }

      row.addComponents(btn);
    }

    rows.push(row);
  }

  return rows;
}

export function renderCaroEmbed(game: CaroGame): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (game.status === 'playing') {
    const isXTurn = game.currentTurn === 'X';
    const currentName = isXTurn ? game.playerX.username : game.playerO.username;
    const currentPiece = isXTurn ? '❌' : '⭕';
    const diffText = game.isBotMatch ? ` • Độ khó: **${game.botDifficulty.toUpperCase()}**` : '';

    embed.setTitle('⚔️ ĐẠI CHIẾN CỜ CARO (BLITZ 5x5)')
      .setColor('#3a86ff')
      .setDescription(
        `🥊 **Trận đấu:** ❌ **${game.playerX.username}** VS ⭕ **${game.playerO.username}**${diffText}\n` +
        `🎯 **Luật chơi:** Đạt **4 quân cờ liên tiếp** (ngang, dọc, chéo) trước để chiến thắng!\n\n` +
        `👉 **Đang đến lượt:** ${currentPiece} **${currentName}**\n` +
        `⏳ Nước đi thứ: \`#${game.movesCount + 1}\` (Bấm vào nút cờ bên dưới để đánh)`
      )
      .setFooter({ text: 'SentinelBot Caro Engine • Bấm nút để đánh cờ • Hết giờ sau 60s' })
      .setTimestamp();
  } else if (game.status === 'ended') {
    if (game.winner === 'draw') {
      embed.setTitle('🤝 TRẬN CỜ CARO KẾT THÚC: BẤT PHÂN THẮNG BẠI!')
        .setColor('#adb5bd')
        .setDescription(
          `Cả hai kỳ thủ **${game.playerX.username}** và **${game.playerO.username}** đều thủ thế vững vàng!\n` +
          `Bàn cờ đã kín chỗ sau **${game.movesCount}** nước đi kịch tính.`
        )
        .setFooter({ text: 'Dùng !caro @user hoặc !caro bot để phục thù!' });
    } else {
      const winnerName = game.winner === 'X' ? game.playerX.username : game.playerO.username;
      const winnerPiece = game.winner === 'X' ? '❌' : '⭕';
      const loserName = game.winner === 'X' ? game.playerO.username : game.playerX.username;

      embed.setTitle(`🏆 CHIẾN THẮNG TUYỆT ĐỐI THUỘC VỀ: ${winnerName.toUpperCase()}!`)
        .setColor(game.winner === 'X' ? '#ef233c' : '#2ec4b6')
        .setDescription(
          `🎉 Kỳ thủ ${winnerPiece} **${winnerName}** đã xuất sắc tung ra nước cờ quyết định kết liễu trận đấu trước **${loserName}**!\n` +
          `📊 Số nước đi: **${game.movesCount}** nước.\n` +
          `⭐ Điểm xếp hạng đã được cập nhật vào Bảng Vàng Cờ Caro!`
        )
        .setFooter({ text: 'Dùng !caro stats để xem hồ sơ kỳ thủ' })
        .setTimestamp();
    }
  }

  return embed;
}

// --- Tạo Trận Đấu Mới ---
export function createNewCaroGame(params: {
  channelId: string;
  guildId: string;
  challengerId: string;
  challengerName: string;
  targetId: string;
  targetName: string;
  isBotMatch: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard' | 'master';
}): CaroGame {
  const gameId = `cg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const board: Array<Array<'X' | 'O' | null>> = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => null)
  );

  const game: CaroGame = {
    id: gameId,
    channelId: params.channelId,
    guildId: params.guildId,
    challengerId: params.challengerId,
    targetId: params.targetId,
    playerX: { id: params.challengerId, username: params.challengerName, isBot: false },
    playerO: {
      id: params.targetId,
      username: params.targetName,
      isBot: params.isBotMatch,
    },
    isBotMatch: params.isBotMatch,
    botDifficulty: params.botDifficulty || 'hard',
    boardSize: 5,
    winCondition: 4,
    board,
    currentTurn: 'X',
    status: params.isBotMatch ? 'playing' : 'pending',
    createdAt: Date.now(),
    lastMoveAt: Date.now(),
    movesCount: 0,
    expiresAt: Date.now() + 60000,
  };

  if (params.isBotMatch) {
    activeCaroGames.set(gameId, game);
    userToGameMap.set(params.challengerId, gameId);
  } else {
    pendingCaroChallenges.set(gameId, game);
  }

  return game;
}

// --- Xử Lý Nút Bấm Trong Trận Đấu Cờ Caro ---
export async function handleCaroButtonClick(interaction: ButtonInteraction, client: Client): Promise<boolean> {
  const { customId, user } = interaction;

  // 1. Xử lý chấp nhận hoặc từ chối lời mời
  if (customId.startsWith('caro_acc_') || customId.startsWith('caro_dec_')) {
    const isAccept = customId.startsWith('caro_acc_');
    const gameId = customId.replace(isAccept ? 'caro_acc_' : 'caro_dec_', '');
    const pendingGame = pendingCaroChallenges.get(gameId);

    if (!pendingGame) {
      await interaction.reply({ content: '⏳ Lời thách đấu cờ Caro này đã hết hạn hoặc không còn tồn tại!', ephemeral: true });
      return true;
    }

    if (user.id !== pendingGame.targetId) {
      await interaction.reply({ content: '❌ Chỉ người được thách đấu mới có quyền Chấp nhận hoặc Từ chối!', ephemeral: true });
      return true;
    }

    pendingCaroChallenges.delete(gameId);

    if (!isAccept) {
      await interaction.update({
        content: `🏳️ **${user.username}** đã từ chối lời thách đấu cờ Caro của **${pendingGame.playerX.username}**!`,
        embeds: [],
        components: [],
      });
      return true;
    }

    // Chấp nhận: bắt đầu trận đấu
    pendingGame.status = 'playing';
    pendingGame.lastMoveAt = Date.now();
    activeCaroGames.set(gameId, pendingGame);
    userToGameMap.set(pendingGame.playerX.id, gameId);
    userToGameMap.set(pendingGame.playerO.id, gameId);

    const embed = renderCaroEmbed(pendingGame);
    const components = renderCaroComponents(pendingGame);

    await interaction.update({
      content: `⚔️ **${user.username}** đã chấp nhận lời thách đấu! Trận chiến bắt đầu!`,
      embeds: [embed],
      components,
    });
    return true;
  }

  // 2. Xử lý nước đi trên bàn cờ: `caro_cell_${gameId}_${r}_${c}`
  if (customId.startsWith('caro_cell_')) {
    const parts = customId.split('_');
    // caro, cell, gameId, r, c
    if (parts.length < 5) return false;
    const gameId = parts[2];
    const r = parseInt(parts[3], 10);
    const c = parseInt(parts[4], 10);

    const game = activeCaroGames.get(gameId);
    if (!game || game.status !== 'playing') {
      await interaction.reply({ content: '⚠️ Ván cờ này đã kết thúc hoặc không còn hiệu lực!', ephemeral: true });
      return true;
    }

    // Xác định người chơi hiện tại
    const isPlayerX = user.id === game.playerX.id;
    const isPlayerO = user.id === game.playerO.id;

    if (!isPlayerX && !isPlayerO) {
      await interaction.reply({ content: '👀 Bạn chỉ là khán giả đang theo dõi trận đấu, không thể đánh cờ hộ!', ephemeral: true });
      return true;
    }

    // Kiểm tra đúng lượt chưa
    if ((game.currentTurn === 'X' && !isPlayerX) || (game.currentTurn === 'O' && !isPlayerO)) {
      await interaction.reply({ content: '⏳ Chưa tới lượt của bạn! Vui lòng đợi đối phương đánh cờ.', ephemeral: true });
      return true;
    }

    // Kiểm tra ô đã đánh chưa
    if (game.board[r][c] !== null) {
      await interaction.reply({ content: '❌ Ô này đã có quân cờ rồi, vui lòng chọn ô khác!', ephemeral: true });
      return true;
    }

    // Thực hiện nước đi của người chơi
    const piece = game.currentTurn;
    game.board[r][c] = piece;
    game.movesCount += 1;
    game.lastMoveAt = Date.now();

    // Kiểm tra thắng
    const winResult = checkWinCondition(game.board, game.winCondition);
    if (winResult.winner) {
      game.status = 'ended';
      game.winner = winResult.winner;
      game.winningCoords = winResult.coords;

      // Cập nhật điểm ELO và thống kê
      updateStatsMatchResult(
        game.playerX.id,
        game.playerX.username,
        game.playerO.id,
        game.playerO.username,
        game.isBotMatch,
        game.winner
      );

      // Giải phóng map
      activeCaroGames.delete(game.id);
      userToGameMap.delete(game.playerX.id);
      userToGameMap.delete(game.playerO.id);

      const embed = renderCaroEmbed(game);
      const components = renderCaroComponents(game);
      await interaction.update({ embeds: [embed], components });
      return true;
    }

    // Kiểm tra hòa cờ (kín bàn)
    if (isBoardFull(game.board)) {
      game.status = 'ended';
      game.winner = 'draw';

      updateStatsMatchResult(
        game.playerX.id,
        game.playerX.username,
        game.playerO.id,
        game.playerO.username,
        game.isBotMatch,
        'draw'
      );

      activeCaroGames.delete(game.id);
      userToGameMap.delete(game.playerX.id);
      userToGameMap.delete(game.playerO.id);

      const embed = renderCaroEmbed(game);
      const components = renderCaroComponents(game);
      await interaction.update({ embeds: [embed], components });
      return true;
    }

    // Đổi lượt
    game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';

    // NẾU LÀ ĐẤU VỚI BOT VÀ ĐẾN LƯỢT BOT
    if (game.isBotMatch && game.currentTurn === 'O') {
      const botMove = getBotBestMove(game.board, 'O', game.botDifficulty);
      game.board[botMove.r][botMove.c] = 'O';
      game.movesCount += 1;
      game.lastMoveAt = Date.now();

      // Kiểm tra Bot có thắng không
      const botWinResult = checkWinCondition(game.board, game.winCondition);
      if (botWinResult.winner) {
        game.status = 'ended';
        game.winner = botWinResult.winner;
        game.winningCoords = botWinResult.coords;

        updateStatsMatchResult(
          game.playerX.id,
          game.playerX.username,
          game.playerO.id,
          game.playerO.username,
          game.isBotMatch,
          game.winner
        );

        activeCaroGames.delete(game.id);
        userToGameMap.delete(game.playerX.id);
        userToGameMap.delete(game.playerO.id);

        const embed = renderCaroEmbed(game);
        const components = renderCaroComponents(game);
        await interaction.update({ embeds: [embed], components });
        return true;
      }

      // Kiểm tra hòa cờ sau nước Bot
      if (isBoardFull(game.board)) {
        game.status = 'ended';
        game.winner = 'draw';

        updateStatsMatchResult(
          game.playerX.id,
          game.playerX.username,
          game.playerO.id,
          game.playerO.username,
          game.isBotMatch,
          'draw'
        );

        activeCaroGames.delete(game.id);
        userToGameMap.delete(game.playerX.id);
        userToGameMap.delete(game.playerO.id);

        const embed = renderCaroEmbed(game);
        const components = renderCaroComponents(game);
        await interaction.update({ embeds: [embed], components });
        return true;
      }

      // Trả lại lượt cho Player X
      game.currentTurn = 'X';
    }

    const embed = renderCaroEmbed(game);
    const components = renderCaroComponents(game);
    await interaction.update({ embeds: [embed], components });
    return true;
  }

  return false;
}

// --- Xử Lý Lệnh Prefix Cờ Caro: !caro / .caro ---
export async function handleCaroPrefixCommand(message: Message, args: string[], client: Client, prefix: string) {
  const sub = args[0]?.toLowerCase();

  // 1. Xem hướng dẫn cờ Caro
  if (!sub || sub === 'help' || sub === 'huongdan') {
    const embed = new EmbedBuilder()
      .setTitle('🎮 SENTINELBOT CARO ENGINE - HƯỚNG DẪN ĐẤU CỜ')
      .setColor('#3a86ff')
      .setDescription(
        `Chế độ cờ Caro tương tác trực tiếp bằng **Discord Buttons** cực mượt mà!\n\n` +
        `**⚡ Các lệnh thách đấu:**\n` +
        `• \`${prefix}caro bot [easy|medium|hard|master]\`: Solo ngay với Bot AI thông minh!\n` +
        `• \`${prefix}caro @user\`: Gửi lời thách đấu tới bạn bè trong server.\n` +
        `• \`${prefix}caro stats [@user]\`: Xem hồ sơ kỳ thủ, điểm ELO, Rank và tỷ lệ thắng.\n` +
        `• \`${prefix}caro top\` hoặc \`${prefix}caro rank\`: Xem Bảng Vàng Top 10 cao thủ cờ Caro.\n` +
        `• \`${prefix}caro resign\` / \`${prefix}caro surrender\`: Đầu hàng ván cờ hiện tại.\n\n` +
        `**🎯 Luật chơi Blitz 5x5:**\n` +
        `• Mỗi lượt bấm vào nút \`▫️\` tương ứng trên bàn cờ để hạ quân \`❌\` hoặc \`⭕\`.\n` +
        `• Kỳ thủ nào xếp được **4 quân cờ liên tiếp** (ngang, dọc hoặc chéo) trước sẽ giành chiến thắng!\n` +
        `• Thắng trận được cộng điểm ELO để thăng hạng Kỳ Thủ 👑!`
      )
      .setFooter({ text: 'Có thể dùng Slash command: /caro' });

    await message.reply({ embeds: [embed] });
    return;
  }

  // 2. Thách đấu với Bot AI
  if (sub === 'bot' || sub === 'ai') {
    const existingGameId = userToGameMap.get(message.author.id);
    if (existingGameId && activeCaroGames.has(existingGameId)) {
      await message.reply(`⚠️ Bạn đang trong một ván cờ Caro khác! Hãy hoàn thành ván đấu hoặc dùng \`${prefix}caro resign\` để đầu hàng.`);
      return;
    }

    const diffArg = args[1]?.toLowerCase();
    let difficulty: 'easy' | 'medium' | 'hard' | 'master' = 'hard';
    if (diffArg === 'easy' || diffArg === 'de') difficulty = 'easy';
    else if (diffArg === 'medium' || diffArg === 'vua') difficulty = 'medium';
    else if (diffArg === 'master' || diffArg === 'daisu') difficulty = 'master';

    const game = createNewCaroGame({
      channelId: message.channel.id,
      guildId: message.guild?.id || 'dm',
      challengerId: message.author.id,
      challengerName: message.author.username,
      targetId: client.user?.id || 'bot',
      targetName: `${client.user?.username || 'SentinelBot'} [AI]`,
      isBotMatch: true,
      botDifficulty: difficulty,
    });

    const embed = renderCaroEmbed(game);
    const components = renderCaroComponents(game);

    await message.reply({
      content: `🤖 **${message.author.username}** đã bước vào đấu trường Caro với **SentinelBot (Cấp độ: ${difficulty.toUpperCase()})**! Bạn đi trước (❌).`,
      embeds: [embed],
      components,
    });
    return;
  }

  // 3. Xem bảng xếp hạng
  if (sub === 'top' || sub === 'rank' || sub === 'bxh') {
    const list = getAllLeaderboard().slice(0, 10);
    if (list.length === 0) {
      await message.reply('🏆 Chưa có kỳ thủ nào ghi danh trên bảng xếp hạng cờ Caro! Hãy dùng `.caro bot` để mở màn!');
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const desc = list.map((p, i) => {
      const tier = getRankTier(p.rating);
      const total = p.wins + p.losses + p.draws;
      const winRate = total > 0 ? ((p.wins / total) * 100).toFixed(1) : '0';
      return `${medals[i] || '▫️'} **${p.username}** • ${tier.badge} \`${p.rating} ELO\`\n` +
        `   └ Thắng: **${p.wins}** | Thua: **${p.losses}** | Tỉ lệ: **${winRate}%** | Chuỗi: 🔥 **${p.streak}**`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 BẢNG VÀNG CAO THỦ CỜ CARO (TOP 10)')
      .setColor('#ffd166')
      .setDescription(desc)
      .setFooter({ text: `Tổng cộng ${getAllLeaderboard().length} kỳ thủ đã tham gia đấu trường` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // 4. Xem thống kê cá nhân
  if (sub === 'stats' || sub === 'profile' || sub === 'me') {
    let target = message.mentions.users.first() || message.author;
    const stats = getPlayerStats(target.id, target.username);
    const tier = getRankTier(stats.rating);
    const total = stats.wins + stats.losses + stats.draws;
    const winRate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ HỒ SƠ KỲ THỦ: ${stats.username.toUpperCase()}`)
      .setColor(tier.color as any)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '🏆 Điểm ELO', value: `\`${stats.rating}\` (${tier.badge} ${tier.title})`, inline: true },
        { name: '🔥 Chuỗi Thắng', value: `Hiện tại: **${stats.streak}** | Kỷ lục: **${stats.bestStreak}**`, inline: true },
        { name: '📊 Tỉ Lệ Thắng', value: `**${winRate}%** (${stats.wins}W / ${stats.losses}L / ${stats.draws}D)`, inline: true },
        { name: '🤖 Đấu Với Bot', value: `Thắng: **${stats.botWins}** | Thua: **${stats.botLosses}**`, inline: true },
        { name: '🎮 Tổng Trận', value: `**${total}** trận đã so tài`, inline: true }
      )
      .setFooter({ text: 'SentinelBot Caro Rating System' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // 5. Đầu hàng ván cờ
  if (sub === 'resign' || sub === 'surrender' || sub === 'thua') {
    const existingGameId = userToGameMap.get(message.author.id);
    if (!existingGameId || !activeCaroGames.has(existingGameId)) {
      await message.reply('❌ Bạn không ở trong ván cờ nào để xin đầu hàng!');
      return;
    }

    const game = activeCaroGames.get(existingGameId)!;
    const isPlayerX = message.author.id === game.playerX.id;
    game.status = 'ended';
    game.winner = isPlayerX ? 'O' : 'X';

    updateStatsMatchResult(
      game.playerX.id,
      game.playerX.username,
      game.playerO.id,
      game.playerO.username,
      game.isBotMatch,
      game.winner
    );

    activeCaroGames.delete(game.id);
    userToGameMap.delete(game.playerX.id);
    userToGameMap.delete(game.playerO.id);

    const winnerName = game.winner === 'X' ? game.playerX.username : game.playerO.username;
    await message.reply(`🏳️ **${message.author.username}** đã xin đầu hàng! Chiến thắng thuộc về **${winnerName}**!`);
    return;
  }

  // 6. Thách đấu người khác (mention)
  const targetUser = message.mentions.users.first();
  if (targetUser) {
    if (targetUser.id === message.author.id) {
      await message.reply('😂 Bạn không thể tự thách đấu chính mình! Muốn luyện tập hãy dùng `.caro bot`.');
      return;
    }

    if (targetUser.bot) {
      await message.reply(`🤖 Để đấu với Bot AI, hãy dùng lệnh \`${prefix}caro bot [easy|medium|hard|master]\`!`);
      return;
    }

    const p1InGame = userToGameMap.get(message.author.id);
    if (p1InGame && activeCaroGames.has(p1InGame)) {
      await message.reply(`⚠️ Bạn đang trong một ván cờ Caro khác!`);
      return;
    }

    const p2InGame = userToGameMap.get(targetUser.id);
    if (p2InGame && activeCaroGames.has(p2InGame)) {
      await message.reply(`⚠️ **${targetUser.username}** hiện đang bận đánh một ván cờ khác!`);
      return;
    }

    const game = createNewCaroGame({
      channelId: message.channel.id,
      guildId: message.guild?.id || 'dm',
      challengerId: message.author.id,
      challengerName: message.author.username,
      targetId: targetUser.id,
      targetName: targetUser.username,
      isBotMatch: false,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`caro_acc_${game.id}`)
        .setLabel('⚔️ Chấp Nhận')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`caro_dec_${game.id}`)
        .setLabel('🏳️ Từ Chối')
        .setStyle(ButtonStyle.Danger)
    );

    const inviteEmbed = new EmbedBuilder()
      .setTitle('⚔️ THÁCH ĐẤU CỜ CARO!')
      .setColor('#ff006e')
      .setDescription(
        `🥊 **${message.author.username}** đã gửi lời thách đấu cờ Caro 5x5 tới **${targetUser.username}**!\n\n` +
        `👉 <@${targetUser.id}>, bạn có dám nhận lời thách đấu này không?\n` +
        `⏳ Lời mời sẽ tự động hủy sau **60 giây**.`
      )
      .setThumbnail(targetUser.displayAvatarURL());

    await message.reply({ embeds: [inviteEmbed], components: [row] });
    return;
  }

  // Không khớp
  await message.reply(`💡 Cú pháp cờ Caro: \`${prefix}caro bot\` (đấu AI) hoặc \`${prefix}caro @user\` (thách đấu bạn bè). Dùng \`${prefix}caro help\` để xem thêm!`);
}

// --- Xử Lý Slash Command /caro ---
export async function handleCaroSlashCommand(interaction: ChatInputCommandInteraction, client: Client): Promise<boolean> {
  if (interaction.commandName !== 'caro') return false;

  const sub = interaction.options.getSubcommand();

  if (sub === 'bot') {
    const existingGameId = userToGameMap.get(interaction.user.id);
    if (existingGameId && activeCaroGames.has(existingGameId)) {
      await interaction.reply({
        content: `⚠️ Bạn đang trong một ván cờ Caro! Hãy hoàn thành ván đấu hoặc dùng \`/caro resign\` để đầu hàng.`,
        ephemeral: true,
      });
      return true;
    }

    const difficulty = (interaction.options.getString('difficulty') as any) || 'hard';

    const game = createNewCaroGame({
      channelId: interaction.channelId,
      guildId: interaction.guildId || 'dm',
      challengerId: interaction.user.id,
      challengerName: interaction.user.username,
      targetId: client.user?.id || 'bot',
      targetName: `${client.user?.username || 'SentinelBot'} [AI]`,
      isBotMatch: true,
      botDifficulty: difficulty,
    });

    const embed = renderCaroEmbed(game);
    const components = renderCaroComponents(game);

    await interaction.reply({
      content: `🤖 **${interaction.user.username}** đã bước vào đấu trường Caro với **SentinelBot (Cấp độ: ${difficulty.toUpperCase()})**! Bạn đi trước (❌).`,
      embeds: [embed],
      components,
    });
    return true;
  }

  if (sub === 'challenge') {
    const targetUser = interaction.options.getUser('user', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: '😂 Bạn không thể tự thách đấu chính mình! Muốn đấu bot hãy dùng `/caro bot`.', ephemeral: true });
      return true;
    }

    if (targetUser.bot) {
      await interaction.reply({ content: '🤖 Để thách đấu bot AI, hãy dùng lệnh `/caro bot`!', ephemeral: true });
      return true;
    }

    const p1InGame = userToGameMap.get(interaction.user.id);
    if (p1InGame && activeCaroGames.has(p1InGame)) {
      await interaction.reply({ content: `⚠️ Bạn đang trong một ván cờ Caro khác!`, ephemeral: true });
      return true;
    }

    const p2InGame = userToGameMap.get(targetUser.id);
    if (p2InGame && activeCaroGames.has(p2InGame)) {
      await interaction.reply({ content: `⚠️ **${targetUser.username}** hiện đang bận đánh một ván cờ khác!`, ephemeral: true });
      return true;
    }

    const game = createNewCaroGame({
      channelId: interaction.channelId,
      guildId: interaction.guildId || 'dm',
      challengerId: interaction.user.id,
      challengerName: interaction.user.username,
      targetId: targetUser.id,
      targetName: targetUser.username,
      isBotMatch: false,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`caro_acc_${game.id}`)
        .setLabel('⚔️ Chấp Nhận')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`caro_dec_${game.id}`)
        .setLabel('🏳️ Từ Chối')
        .setStyle(ButtonStyle.Danger)
    );

    const inviteEmbed = new EmbedBuilder()
      .setTitle('⚔️ THÁCH ĐẤU CỜ CARO!')
      .setColor('#ff006e')
      .setDescription(
        `🥊 **${interaction.user.username}** đã gửi lời thách đấu cờ Caro 5x5 tới **${targetUser.username}**!\n\n` +
        `👉 <@${targetUser.id}>, bạn có dám nhận lời thách đấu này không?\n` +
        `⏳ Lời mời sẽ tự động hủy sau **60 giây**.`
      )
      .setThumbnail(targetUser.displayAvatarURL());

    await interaction.reply({ embeds: [inviteEmbed], components: [row] });
    return true;
  }

  if (sub === 'top') {
    const list = getAllLeaderboard().slice(0, 10);
    if (list.length === 0) {
      await interaction.reply({ content: '🏆 Chưa có kỳ thủ nào ghi danh trên bảng xếp hạng cờ Caro! Hãy dùng `/caro bot` để mở màn!', ephemeral: true });
      return true;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const desc = list.map((p, i) => {
      const tier = getRankTier(p.rating);
      const total = p.wins + p.losses + p.draws;
      const winRate = total > 0 ? ((p.wins / total) * 100).toFixed(1) : '0';
      return `${medals[i] || '▫️'} **${p.username}** • ${tier.badge} \`${p.rating} ELO\`\n` +
        `   └ Thắng: **${p.wins}** | Thua: **${p.losses}** | Tỉ lệ: **${winRate}%** | Chuỗi: 🔥 **${p.streak}**`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 BẢNG VÀNG CAO THỦ CỜ CARO (TOP 10)')
      .setColor('#ffd166')
      .setDescription(desc)
      .setFooter({ text: `Tổng cộng ${getAllLeaderboard().length} kỳ thủ đã tham gia đấu trường` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return true;
  }

  if (sub === 'stats') {
    const target = interaction.options.getUser('user') || interaction.user;
    const stats = getPlayerStats(target.id, target.username);
    const tier = getRankTier(stats.rating);
    const total = stats.wins + stats.losses + stats.draws;
    const winRate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : '0';

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ HỒ SƠ KỲ THỦ: ${stats.username.toUpperCase()}`)
      .setColor(tier.color as any)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '🏆 Điểm ELO', value: `\`${stats.rating}\` (${tier.badge} ${tier.title})`, inline: true },
        { name: '🔥 Chuỗi Thắng', value: `Hiện tại: **${stats.streak}** | Kỷ lục: **${stats.bestStreak}**`, inline: true },
        { name: '📊 Tỉ Lệ Thắng', value: `**${winRate}%** (${stats.wins}W / ${stats.losses}L / ${stats.draws}D)`, inline: true },
        { name: '🤖 Đấu Với Bot', value: `Thắng: **${stats.botWins}** | Thua: **${stats.botLosses}**`, inline: true },
        { name: '🎮 Tổng Trận', value: `**${total}** trận đã so tài`, inline: true }
      )
      .setFooter({ text: 'SentinelBot Caro Rating System' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    return true;
  }

  if (sub === 'resign') {
    const existingGameId = userToGameMap.get(interaction.user.id);
    if (!existingGameId || !activeCaroGames.has(existingGameId)) {
      await interaction.reply({ content: '❌ Bạn không ở trong ván cờ nào để xin đầu hàng!', ephemeral: true });
      return true;
    }

    const game = activeCaroGames.get(existingGameId)!;
    const isPlayerX = interaction.user.id === game.playerX.id;
    game.status = 'ended';
    game.winner = isPlayerX ? 'O' : 'X';

    updateStatsMatchResult(
      game.playerX.id,
      game.playerX.username,
      game.playerO.id,
      game.playerO.username,
      game.isBotMatch,
      game.winner
    );

    activeCaroGames.delete(game.id);
    userToGameMap.delete(game.playerX.id);
    userToGameMap.delete(game.playerO.id);

    const winnerName = game.winner === 'X' ? game.playerX.username : game.playerO.username;
    await interaction.reply(`🏳️ **${interaction.user.username}** đã xin đầu hàng! Chiến thắng thuộc về **${winnerName}**!`);
    return true;
  }

  return false;
}
