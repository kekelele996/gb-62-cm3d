import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { addPoints } from './authController';
import { UserLevel } from '@prisma/client';

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar: string | null;
  level: UserLevel;
  points: number;
  rank: number;
}

export interface GrowthData {
  checkedIn: boolean;
  streakDays: number;
  monthCount: number;
  points: number;
  level: UserLevel;
  rank: number;
}

// 取本地时区当天 0 点（按自然日计算）
const startOfToday = (): Date => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

// YYYY-MM-DD，作为自然日的唯一标识
const dayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 连续签到天数：从今天（或昨天）起向前逐天累计，漏签即中断
export const calculateStreak = (checkInDays: Set<string>): number => {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // 今天还没签时，连续记录从昨天开始算，今天不视为漏签
  if (!checkInDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (checkInDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const buildGrowthData = async (userId: string): Promise<GrowthData> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = startOfToday();

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const [checkIns, higherPointsCount] = await Promise.all([
    // 取全部签到日期：连续天数可能跨月回溯；本月次数由日期过滤得出
    prisma.checkIn.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: 'desc' }
    }),
    // 同分并列：名次 = 积分严格更高的人数 + 1
    prisma.user.count({ where: { points: { gt: user.points } } })
  ]);

  const checkInDays = new Set(checkIns.map((item) => dayKey(new Date(item.date))));
  const todayKey = dayKey(today);
  const monthCount = checkIns.filter((item) => new Date(item.date) >= monthStart).length;

  return {
    checkedIn: checkInDays.has(todayKey),
    streakDays: calculateStreak(checkInDays),
    monthCount,
    points: user.points,
    level: user.level,
    rank: higherPointsCount + 1
  };
};

const buildLeaderboard = async (currentUserId: string): Promise<{ top: LeaderboardEntry[]; me: LeaderboardEntry | null }> => {
  // 榜单按积分从高到低；同分用注册时间、用户名保证排列稳定
  const users = await prisma.user.findMany({
    orderBy: [{ points: 'desc' }, { createdAt: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      avatar: true,
      level: true,
      points: true
    }
  });

  const ranked = assignRanks(users);
  const top = ranked.slice(0, 10);

  const myIndex = ranked.findIndex((entry) => entry.id === currentUserId);
  const me = myIndex >= 10 ? ranked[myIndex] : null;

  return { top, me };
};

// 同分名次并列：名次取该分数第一次出现的位置（1 开始）
export const assignRanks = <T extends { points: number }>(
  orderedEntries: T[]
): (T & { rank: number })[] => {
  let lastPoints: number | null = null;
  let lastRank = 0;
  return orderedEntries.map((entry, index) => {
    if (entry.points !== lastPoints) {
      lastPoints = entry.points;
      lastRank = index + 1;
    }
    return { ...entry, rank: lastRank };
  });
};

export const checkIn = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const today = startOfToday();

  try {
    const existingCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId,
        date: {
          gte: today
        }
      }
    });

    // 重复签到不加分，直接返回当天最新统计
    if (existingCheckIn) {
      const [growth, leaderboard] = await Promise.all([
        buildGrowthData(userId),
        buildLeaderboard(userId)
      ]);
      return res.status(400).json({ error: '今天已签到', growth, leaderboard });
    }

    await prisma.checkIn.create({
      data: {
        userId,
        date: today,
        points: 10
      }
    });

    await addPoints(userId, 10);

    // 签到后统计和榜单当场更新
    const [growth, leaderboard] = await Promise.all([
      buildGrowthData(userId),
      buildLeaderboard(userId)
    ]);

    res.status(201).json({
      message: '签到成功',
      points: 10,
      growth,
      leaderboard
    });
  } catch (error: any) {
    // 并发签到时唯一索引兜底，视为今天已签到
    if (error?.code === 'P2002') {
      const [growth, leaderboard] = await Promise.all([
        buildGrowthData(userId),
        buildLeaderboard(userId)
      ]);
      return res.status(400).json({ error: '今天已签到', growth, leaderboard });
    }
    res.status(500).json({ error: '签到失败' });
  }
};

export const getCheckInStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const [growth, leaderboard] = await Promise.all([
      buildGrowthData(userId),
      buildLeaderboard(userId)
    ]);

    res.json({ checkedIn: growth.checkedIn, growth, leaderboard });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
};
