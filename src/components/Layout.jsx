import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  FileText,
  Home,
  LogOut,
  Menu,
  PieChart,
  QrCode,
  ShoppingCart,
  Tag,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const navigationGroups = [
  {
    label: 'Vận hành',
    items: [
      { path: '/', label: 'Tạo đơn', icon: Home },
      { path: '/bills', label: 'Quản lý đơn', icon: FileText },
    ],
  },
  {
    label: 'Menu & bàn',
    items: [
      { path: '/menu', label: 'Menu, món gọi & bàn', icon: ShoppingCart },
      { path: '/qr', label: 'QR khách hàng', icon: QrCode },
    ],
  },
  {
    label: 'Tài chính',
    items: [
      { path: '/expenses', label: 'Vốn hằng ngày', icon: Wallet },
      { path: '/fixed-costs', label: 'Chi phí cố định', icon: Building2 },
      { path: '/expense-categories', label: 'Danh mục chi phí', icon: Tag },
    ],
  },
  {
    label: 'Phân tích',
    items: [
      { path: '/reports', label: 'Báo cáo P&L', icon: BarChart3 },
      { path: '/dish-analysis', label: 'Tổng kết món', icon: PieChart },
    ],
  },
];

const NavItem = ({ item, onClick }) => {
  const Icon = item.icon;

  return (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-100'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
        }`
      }
    >
      <Icon size={18} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
};

const NavGroups = ({ onNavigate }) => (
  <nav className="space-y-5">
    {navigationGroups.map((group) => (
      <div key={group.label}>
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
          {group.label}
        </p>
        <div className="space-y-1">
          {group.items.map((item) => (
            <NavItem key={item.path} item={item} onClick={onNavigate} />
          ))}
        </div>
      </div>
    ))}
  </nav>
);

const Layout = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout } = useApp();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg-app)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--border-subtle)] bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Quán Ốc</p>
            <h1 className="text-base font-bold text-gray-950">Bảng điều hành</h1>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-950"
            aria-label={isMenuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {isMenuOpen && (
        <div className="border-b border-[color:var(--border-subtle)] bg-white px-4 py-4 shadow-sm lg:hidden">
          <NavGroups onNavigate={() => setIsMenuOpen(false)} />
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      )}

      <div className="lg:flex">
        <aside className="hidden min-h-screen w-72 shrink-0 border-r border-[color:var(--border-subtle)] bg-white lg:sticky lg:top-0 lg:flex lg:flex-col">
          <div className="border-b border-[color:var(--border-subtle)] px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Quán Ốc</p>
            <h1 className="mt-1 text-xl font-bold text-gray-950">Bảng điều hành</h1>
            <p className="mt-1 text-sm text-gray-500">Order, bếp và tài chính</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <NavGroups />
          </div>

          <div className="border-t border-[color:var(--border-subtle)] p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
