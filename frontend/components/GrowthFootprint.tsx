'use client';

import { Flame, CalendarDays, Coins, Trophy } from 'lucide-react';
import { GrowthData, LeaderboardEntry, LeaderboardResponse } from '@/types';
import { getLevelIcon } from './LevelBadge';

interface GrowthFootprintProps {
  growth: GrowthData | null;
  leaderboard: LeaderboardResponse | null;
  currentUserId: string;
}

const statItems = (growth: GrowthData | null) => [
  {
    label: '连续签到',
    value: growth ? `${growth.streakDays} 天` : '—',
    icon: Flame,
    color: 'text-orange-500',
    bg: 'bg-orange-50'
  },
  {
    label: '本月签到',
    value: growth ? `${growth.monthCount} 次` : '—',
    icon: CalendarDays,
    color: 'text-blue-500',
    bg: 'bg-blue-50'
  },
  {
    label: '当前积分',
    value: growth ? `${growth.points}` : '—',
    icon: Coins,
    color: 'text-green-600',
    bg: 'bg-green-50'
  },
  {
    label: '个人名次',
    value: growth ? `第 ${growth.rank} 名` : '—',
    icon: Trophy,
    color: 'text-purple-500',
    bg: 'bg-purple-50'
  }
];

const rankBadgeClass = (rank: number): string => {
  if (rank === 1) return 'bg-amber-100 text-amber-700';
  if (rank === 2) return 'bg-slate-200 text-slate-600';
  if (rank === 3) return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-500';
};

const rankMedal = (rank: number): string => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
};

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <div
      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg ${
        isMe ? 'bg-green-50 ring-1 ring-green-200' : 'hover:bg-gray-50'
      }`}
    >
      <span
        className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${rankBadgeClass(
          entry.rank
        )}`}
      >
        {rankMedal(entry.rank) || entry.rank}
      </span>
      {entry.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.avatar} alt={entry.username} className="w-8 h-8 rounded-full object-cover" />
      ) : (
        <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-medium">
          {entry.username.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-800">
        {entry.username}
        {isMe && <span className="ml-2 text-xs text-green-600">（我）</span>}
      </span>
      <span className="text-sm shrink-0" title="等级">
        {getLevelIcon(entry.level)}
      </span>
      <span className="text-sm font-semibold text-green-600 shrink-0 w-16 text-right">
        {entry.points} 分
      </span>
    </div>
  );
}

export default function GrowthFootprint({ growth, leaderboard, currentUserId }: GrowthFootprintProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Trophy className="w-6 h-6 text-green-500" />
        <div>
          <h3 className="text-lg font-bold text-gray-800">成长足迹</h3>
          <p className="text-sm text-gray-500">坚持签到，看看你在花友中的位置</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statItems(growth).map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`p-4 rounded-lg ${item.bg} text-center`}>
              <Icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
              <p className="text-lg font-bold text-gray-800">{item.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800">积分榜 · 前十</h4>
        <span className="text-xs text-gray-400">同分并列，按积分从高到低</span>
      </div>

      <div className="space-y-1">
        {!leaderboard &&
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 rounded-lg bg-gray-50 animate-pulse" />
          ))}

        {leaderboard?.top.map((entry) => (
          <LeaderboardRow
            key={entry.id}
            entry={entry}
            isMe={entry.id === currentUserId}
          />
        ))}

        {/* 自己不在榜内时，仍保留并展示个人名次 */}
        {leaderboard?.me && (
          <>
            <div className="flex items-center my-2">
              <div className="flex-1 border-t border-dashed border-gray-200" />
              <span className="px-3 text-xs text-gray-400">我的排名</span>
              <div className="flex-1 border-t border-dashed border-gray-200" />
            </div>
            <LeaderboardRow entry={leaderboard.me} isMe />
          </>
        )}
      </div>
    </div>
  );
}
