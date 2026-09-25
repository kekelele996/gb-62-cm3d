'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  Flower2,
  BookOpen,
  Users,
  Trophy,
  Bell,
  MessageCircle,
  CalendarCheck,
  Footprints,
  Flame,
  CalendarDays,
  Coins
} from 'lucide-react';
import { pointsApi, messageApi } from '@/lib/api';
import { GrowthData, LeaderboardEntry, UserLevel } from '@/types';
import { getLevelIcon } from '@/components/LevelBadge';

const rankMedal = (rank: number) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
};

const LeaderboardRow = ({ entry }: { entry: LeaderboardEntry }) => (
  <div
    className={`flex items-center space-x-3 px-3 py-2 rounded-lg ${
      entry.isMe ? 'bg-green-50 ring-1 ring-green-200' : 'hover:bg-gray-50'
    }`}
  >
    <div className="w-8 text-center font-bold text-sm text-gray-500 flex-shrink-0">
      {rankMedal(entry.rank) ? (
        <span className="text-lg">{rankMedal(entry.rank)}</span>
      ) : (
        entry.rank
      )}
    </div>
    <Link href={`/profile/${entry.userId}`} className="flex items-center space-x-2 flex-1 min-w-0">
      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
        {entry.avatar ? (
          <img src={entry.avatar} alt={entry.username} className="w-8 h-8 object-cover" />
        ) : (
          <span className="text-sm">{getLevelIcon(entry.level as UserLevel)}</span>
        )}
      </div>
      <span
        className={`font-medium truncate ${entry.isMe ? 'text-green-700' : 'text-gray-800'}`}
      >
        {entry.username}
        {entry.isMe && <span className="ml-1 text-xs text-green-500">（我）</span>}
      </span>
    </Link>
    <span className="text-sm font-medium text-amber-600 flex-shrink-0">{entry.points} 积分</span>
  </div>
);

export default function HomePage() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();
  const [checkedIn, setCheckedIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [growth, setGrowth] = useState<GrowthData | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      loadStatus();
    }
  }, [user]);

  const loadStatus = async () => {
    try {
      const [growthRes, unreadRes] = await Promise.all([
        pointsApi.getGrowth(),
        messageApi.getUnreadCount()
      ]);
      setGrowth(growthRes.data);
      setCheckedIn(growthRes.data.checkedInToday);
      setUnreadCount(unreadRes.data.unreadCount);
    } catch (error) {
      console.error('加载状态失败', error);
    }
  };

  const applyGrowth = (data: GrowthData) => {
    setGrowth(data);
    setCheckedIn(data.checkedInToday);
    const me = data.leaderboard.find((e) => e.isMe);
    updateUser({ points: data.points, ...(me ? { level: me.level } : {}) });
  };

  const handleCheckIn = async () => {
    try {
      const res = await pointsApi.checkIn();
      // 签到后统计和榜单当场更新
      applyGrowth(res.data.growth);
      alert('签到成功！获得 10 积分');
    } catch (error: any) {
      const message = error.response?.data?.error || '签到失败';
      alert(message);
      // 重复签到等情况下重新同步一次统计，保证页面与服务端一致
      if (error.response?.status === 400) {
        loadStatus();
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const stats = [
    { label: '花园日记', path: '/diaries', icon: BookOpen, color: 'bg-green-500', count: '记录生活' },
    { label: '话题广场', path: '/topics', icon: MessageCircle, color: 'bg-blue-500', count: '交流心得' },
    { label: '花友圈', path: '/moments', icon: Users, color: 'bg-purple-500', count: '分享动态' },
    { label: '种植挑战', path: '/challenges', icon: Trophy, color: 'bg-orange-500', count: '赢取奖励' },
  ];

  const growthStats = growth
    ? [
        {
          label: '连续签到',
          value: growth.streak,
          unit: '天',
          icon: Flame,
          color: 'text-orange-500',
          bg: 'bg-orange-50',
        },
        {
          label: '本月签到',
          value: growth.monthCount,
          unit: '次',
          icon: CalendarDays,
          color: 'text-blue-500',
          bg: 'bg-blue-50',
        },
        {
          label: '当前积分',
          value: growth.points,
          unit: '',
          icon: Coins,
          color: 'text-amber-500',
          bg: 'bg-amber-50',
        },
        {
          label: '我的名次',
          value: growth.myRank,
          unit: '名',
          icon: Trophy,
          color: 'text-purple-500',
          bg: 'bg-purple-50',
        },
      ]
    : [];

  // 自己不在前十时，榜单末尾会追加自己的名次
  const appendedMe = growth ? growth.leaderboard.length > 10 : false;
  const topTen = appendedMe ? growth!.leaderboard.slice(0, 10) : growth?.leaderboard ?? [];
  const myEntry = appendedMe ? growth!.leaderboard[growth!.leaderboard.length - 1] : null;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🌱</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">你好，{user.username}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`level-badge level-${user.level}`}>
                  {user.level === 'SEED' && '🌰 种子'}
                  {user.level === 'SPROUT' && '🌱 幼苗'}
                  {user.level === 'FLOWER' && '🌸 花朵'}
                  {user.level === 'TREE' && '🌳 参天大树'}
                </span>
                <span className="text-sm text-gray-500">{user.points} 积分</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/messages" className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
            <button
              onClick={handleCheckIn}
              disabled={checkedIn}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                checkedIn
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              <CalendarCheck className="w-5 h-5" />
              <span>{checkedIn ? '今天已签到' : '签到'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 成长足迹 */}
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Footprints className="w-6 h-6 text-green-500" />
          <h3 className="text-lg font-bold text-gray-800">成长足迹</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {growthStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`${stat.bg} rounded-lg p-4 text-center`}>
                <div className="flex justify-center mb-2">
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {stat.value}
                  {stat.unit && <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>}
                </p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center space-x-2 mb-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h4 className="font-bold text-gray-800">积分榜 · 前十</h4>
        </div>
        {growth && (
          <div className="space-y-1">
            {topTen.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} />
            ))}
            {myEntry && (
              <>
                <div className="px-3 py-1 text-center text-gray-300 tracking-widest">· · ·</div>
                <LeaderboardRow entry={myEntry} />
              </>
            )}
          </div>
        )}
        {!growth && (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.path}
              className="card p-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-medium text-gray-800">{stat.label}</h3>
              <p className="text-sm text-gray-500">{stat.count}</p>
            </Link>
          );
        })}
      </div>

      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Flower2 className="w-6 h-6 text-green-500" />
          <h3 className="text-lg font-bold text-gray-800">欢迎来到园艺社区</h3>
        </div>
        <p className="text-gray-600 leading-relaxed">
          这是一个充满热爱的园艺爱好者社区。在这里，你可以：
        </p>
        <ul className="mt-3 space-y-2 text-gray-600">
          <li className="flex items-center space-x-2">
            <span className="text-green-500">✓</span>
            <span>记录植物的生长过程，分享你的花园日记</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-green-500">✓</span>
            <span>参与热门话题讨论，与花友交流经验</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-green-500">✓</span>
            <span>关注志同道合的花友，看他们的最新动态</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="text-green-500">✓</span>
            <span>参加种植挑战，赢取积分和荣誉</span>
          </li>
        </ul>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">积分等级说明</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <span className="text-2xl">🌰</span>
            <p className="font-medium mt-1">种子</p>
            <p className="text-sm text-gray-500">0 - 499 积分</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <span className="text-2xl">🌱</span>
            <p className="font-medium mt-1">幼苗</p>
            <p className="text-sm text-gray-500">500 - 2999 积分</p>
          </div>
          <div className="text-center p-3 bg-pink-50 rounded-lg">
            <span className="text-2xl">🌸</span>
            <p className="font-medium mt-1">花朵</p>
            <p className="text-sm text-gray-500">3000 - 9999 积分</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <span className="text-2xl">🌳</span>
            <p className="font-medium mt-1">参天大树</p>
            <p className="text-sm text-gray-500">10000+ 积分</p>
          </div>
        </div>
      </div>
    </div>
  );
}
