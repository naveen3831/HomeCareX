import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  FileClock,
  Lock,
  Server,
  ShieldCheck,
  UserCog,
} from 'lucide-react';

interface SettingSection {
  title: string;
  description: string;
  items: {
    title: string;
    description: string;
    to: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export const AdminSettingsPage: React.FC = () => {

  const sections: SettingSection[] = [
    {
      title: 'Security & Access',
      description: 'Manage your administrator account security, credentials, and authentication sessions.',
      items: [
        {
          title: 'Account Security',
          description: 'Change password, view active logged-in sessions, and sign out of all devices.',
          to: '/admin/security',
          icon: Lock,
        },
        {
          title: 'Roles & Permissions',
          description: 'Configure role-based access control (RBAC) and permissions across administrator accounts.',
          to: '/admin/roles-permissions',
          icon: ShieldCheck,
        },
        {
          title: 'Staff Management',
          description: 'Invite, manage, and assign roles to administrative staff members and operators.',
          to: '/admin/staff',
          icon: UserCog,
        },
      ],
    },
    {
      title: 'Audit & Compliance',
      description: 'Review logs, track operational actions, and verify administrative compliance.',
      items: [
        {
          title: 'Audit Logs',
          description: 'Inspect chronological records of security events, administrative actions, and logins.',
          to: '/admin/audit-logs',
          icon: FileClock,
        },
      ],
    },
    {
      title: 'System Information',
      description: 'Platform version and environment details.',
      items: [
        {
          title: 'Platform Environment',
          description: 'Production-ready HomeCareX administrative dashboard suite.',
          to: '#',
          icon: Server,
          badge: 'v1.0.0',
        },
      ],
    },
  ];

  return (
    <div className="admin-page-container p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account security, staff permissions, and system configurations.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
              <p className="text-sm text-slate-500">{section.description}</p>
            </div>

            <div className="divide-y divide-slate-100">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isExternalOrAnchor = item.to === '#';

                const content = (
                  <div className="flex items-center justify-between py-4 group hover:bg-slate-50/80 -mx-6 px-6 transition-colors rounded-xl">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-transform group-hover:scale-105">
                        <Icon size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                          {item.badge && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate sm:whitespace-normal">{item.description}</p>
                      </div>
                    </div>
                    {!isExternalOrAnchor && (
                      <ChevronRight size={18} className="shrink-0 text-slate-400 group-hover:text-indigo-600 transition-colors ml-4" />
                    )}
                  </div>
                );

                return isExternalOrAnchor ? (
                  <div key={item.title}>{content}</div>
                ) : (
                  <Link key={item.title} to={item.to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-xl">
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSettingsPage;
