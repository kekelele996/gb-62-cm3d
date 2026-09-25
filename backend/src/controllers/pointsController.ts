import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/prisma';
import { addPoints } from './authController';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string | null;
  level: string;
  points: number;
  isMe: boolean;
}

export interface GrowthData {
  checkedInToday: boolean;
  streak: number;
  monthCount: number;
  points: number;
  myRank: number;
  leaderboard: LeaderboardEntry[];
}

// 汇总成长足迹数据：连续签到、本月签到、积分、名次及积分榜
const buildGrowthData = async (userId: string): Promise<GrowthData> => {
  const now = new Date();
  const today = startOfDay(now);

  const [me, checkIns] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, avatar: true, level: true, points: true }
    }),
    prisma.checkIn.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true }
    })
  ]);

  if (!me) {
    throw new Error('USER_NOT_FOUND');
  }

  // 同分并列：积分严格高于我的人数 + 1 即我的名次
  const higherCount = await prisma.user.count({
    where: { points: { gt: me.points } }
  });
  const myRank = higherCount + 1;

  // 连续签到：按自然日向前累计，漏签（最近一次签到早于昨天）即归零
  let streak = 0;
  if (checkIns.length > 0) {
    const dates = checkIns.map((c) => startOfDay(c.date).getTime());
    const gapFromToday = Math.round((today.getTime() - dates[0]) / DAY_MS);
    if (gapFromToday <= 1) {
      streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const gap = Math.round((dates[i - 1] - dates[i]) / DAY_MS);
        if (gap === 0) continue; // 同一天的冗余记录
        if (gap === 1) {
          streak += 1;
        } else {
          break;
        }
      }
    }
  }

  // 本月签到次数
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = checkIns.filter((c) => startOfDay(c.date) >= monthStart).length;

  const checkedInToday =
    checkIns.length > 0 &&
    Math.round((today.getTime() - startOfDay(checkIns[0].date).getTime()) / DAY_MS) === 0;

  // 积分榜前十，按积分从高到低；同分时注册早的靠前
  const topUsers = await prisma.user.findMany({
    orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
    take: 10,
    select: { id: true, username: true, avatar: true, level: true, points: true }
  });

  // 榜单内按同分并列（竞争排名：1,2,2,4）标注名次
  const leaderboard: LeaderboardEntry[] = topUsers.map((u) => ({
    rank: topUsers.filter((t) => t.points > u.points).length + 1,
    userId: u.id,
    username: u.username,
    avatar: u.avatar,
    level: u.level,
    points: u.points,
    isMe: u.id === userId
  }));

  // 自己不在前十时，仍然在榜单末尾保留自己的名次
  if (!leaderboard.some((e) => e.isMe)) {
    leaderboard.push({
      rank: myRank,
      userId: me.id,
      username: me.username,
      avatar: me.avatar,
      level: me.level,
      points: me.points,
      isMe: true
    });
  }

  return {
    checkedInToday,
    streak,
    monthCount,
    points: me.points,
    myRank,
    leaderboard
  };
};

export const checkIn = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const existingCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId,
        date: {
          gte: today
        }
      }
    });

    if (existingCheckIn) {
      return res.status(400).json({ error: '今天已签到' });
    }

    await prisma.checkIn.create({
      data: {
        userId,
        date: today,
        points: 10
      }
    });

    await addPoints(userId, 10);

    const growth = await buildGrowthData(userId);

    res.json({ message: '签到成功', points: 10, growth });
  } catch (error) {
    res.status(500).json({ error: '签到失败' });
  }
};

export const getCheckInStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const checkIn = await prisma.checkIn.findFirst({
      where: {
        userId,
        date: {
          gte: today
        }
      }
    });

    res.json({ checkedIn: !!checkIn });
  } catch (error) {
    res.status(500).json({ error: '查询失败' });
  }
};

export const getGrowth = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const growth = await buildGrowthData(userId);
    res.json(growth);
  } catch (error) {
    res.status(500).json({ error: '获取成长足迹失败' });
  }
};
