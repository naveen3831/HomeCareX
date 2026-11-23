import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/models/notification_model.dart';
import '../../providers/notification_provider.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  static const List<Map<String, String>> _tabs = [
    {'key': 'all', 'label': 'All'},
    {'key': 'booking', 'label': 'Booking'},
    {'key': 'payment', 'label': 'Payment'},
    {'key': 'partner', 'label': 'Partner'},
    {'key': 'offers', 'label': 'Offers'},
    {'key': 'support', 'label': 'Support'},
    {'key': 'system', 'label': 'System'},
  ];

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final unreadCount = provider.unreadCount;
    final grouped = provider.groupedNotifications;
    final totalItems = provider.filteredNotifications.length;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF111827),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, size: 22, color: Color(0xFF111827)),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        titleSpacing: 0,
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 1. Sub-header: unread count on left, Mark all read + bin on right
            _buildSubHeader(context, provider, unreadCount, provider.notifications.isNotEmpty),

            // 2. Horizontal Filter Tabs
            _buildFilterTabs(provider),

            // 3. Body: Grouped List or Empty State
            Expanded(
              child: RefreshIndicator(
                color: AppColors.brand,
                onRefresh: provider.fetchNotifications,
                child: totalItems == 0
                    ? _buildEmptyState(provider.selectedGroup)
                    : ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 24),
                        children: [
                          for (final entry in grouped.entries) ...[
                            _buildSectionHeader(entry.key),
                            ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: entry.value.length,
                              separatorBuilder: (_, __) => const Divider(
                                height: 1,
                                thickness: 1,
                                color: Color(0xFFF3F4F6),
                                indent: 16,
                                endIndent: 16,
                              ),
                              itemBuilder: (ctx, index) {
                                final item = entry.value[index];
                                return _buildNotificationTile(context, provider, item);
                              },
                            ),
                          ],
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubHeader(
    BuildContext context,
    NotificationProvider provider,
    int unreadCount,
    bool hasNotifications,
  ) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Left: "2 unread" or "You're all caught up"
          Expanded(
            child: Text(
              unreadCount > 0 ? '$unreadCount unread' : "You're all caught up",
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF6B7280),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Right: [Mark all read] button + [Trash] icon button
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Mark all read button
              GestureDetector(
                onTap: unreadCount > 0 ? () => provider.markAllRead() : null,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: unreadCount > 0 ? const Color(0xFFE5E7EB) : const Color(0xFFF3F4F6),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.check_rounded,
                        size: 15,
                        color: unreadCount > 0 ? const Color(0xFF374151) : const Color(0xFF9CA3AF),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Mark all read',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: unreadCount > 0 ? const Color(0xFF374151) : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(width: 8),

              // Trash button (delete all)
              GestureDetector(
                onTap: hasNotifications ? () => _confirmDeleteAll(context, provider) : null,
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: hasNotifications ? const Color(0xFFFEE2E2) : const Color(0xFFF3F4F6),
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.delete_outline_rounded,
                      size: 16,
                      color: hasNotifications ? const Color(0xFFEF4444) : const Color(0xFFD1D5DB),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAll(BuildContext context, NotificationProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => Theme(
        data: Theme.of(ctx).copyWith(splashFactory: NoSplash.splashFactory),
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Delete all notifications?',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          content: const Text(
            'This will permanently delete all your notifications. This cannot be undone.',
            style: TextStyle(fontSize: 13, color: Color(0xFF4B5563)),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('No, keep them', style: TextStyle(color: Color(0xFF6B7280))),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              ),
              onPressed: () {
                Navigator.of(ctx).pop();
                provider.deleteAll();
              },
              child: const Text('Yes, delete all', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterTabs(NotificationProvider provider) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFF3F4F6), width: 1.5),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: _tabs.map((tab) {
            final key = tab['key']!;
            final label = tab['label']!;
            final isSelected = provider.selectedGroup == key;
            final count = provider.countForGroup(key);

            return GestureDetector(
              onTap: () => provider.selectGroup(key),
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: isSelected ? AppColors.brand : Colors.transparent,
                      width: 2,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                        color: isSelected ? AppColors.brand : const Color(0xFF6B7280),
                      ),
                    ),
                    if (count > 0) ...[
                      const SizedBox(width: 5),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: AppColors.brand,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          count > 99 ? '99+' : '$count',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.1,
          color: Color(0xFF9CA3AF),
        ),
      ),
    );
  }

  Widget _buildNotificationTile(
    BuildContext context,
    NotificationProvider provider,
    NotificationModel item,
  ) {
    final meta = _resolveMeta(item.group);

    return Dismissible(
      key: Key(item.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) => provider.deleteNotification(item.id),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: const Color(0xFFEF4444),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.delete_outline_rounded, color: Colors.white, size: 20),
            SizedBox(width: 6),
            Text(
              'Delete',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
      child: Container(
        color: item.isUnread ? const Color(0xFFFBFBFE) : Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left Category Icon Box
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: meta.backgroundColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Icon(meta.icon, size: 18, color: meta.iconColor),
              ),
            ),

            const SizedBox(width: 12),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title + Time ago
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: item.isUnread ? FontWeight.bold : FontWeight.w600,
                            color: const Color(0xFF111827),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        item.timeAgo,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 3),

                  // Message body
                  Text(
                    item.message,
                    style: const TextStyle(
                      fontSize: 12.5,
                      height: 1.35,
                      color: Color(0xFF4B5563),
                    ),
                  ),

                  const SizedBox(height: 5),

                  // Category tag
                  Text(
                    item.group.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),

                  // Mark as read button (if unread)
                  if (item.isUnread) ...[
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: () => provider.markAsRead(item.id),
                      behavior: HitTestBehavior.opaque,
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.check_rounded,
                            size: 14,
                            color: AppColors.brand,
                          ),
                          SizedBox(width: 4),
                          Text(
                            'Mark as read',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.brand,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(String group) {
    final title = group == 'all'
        ? 'No notifications yet'
        : 'No ${group.toLowerCase()} notifications';

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFF3F4F6),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(
                  Icons.notifications_off_outlined,
                  size: 32,
                  color: Color(0xFF9CA3AF),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Booking updates, payments, offers and support replies will show up here.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF6B7280),
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  _MetaConfig _resolveMeta(String group) {
    switch (group) {
      case 'payment':
        return const _MetaConfig(
          icon: Icons.credit_card_rounded,
          iconColor: Color(0xFF059669),
          backgroundColor: Color(0xFFE8F7EE),
        );
      case 'booking':
        return const _MetaConfig(
          icon: Icons.calendar_today_rounded,
          iconColor: AppColors.brand,
          backgroundColor: Color(0xFFEEECFB),
        );
      case 'partner':
        return const _MetaConfig(
          icon: Icons.person_pin_rounded,
          iconColor: Color(0xFF0284C7),
          backgroundColor: Color(0xFFE0F2FE),
        );
      case 'offers':
        return const _MetaConfig(
          icon: Icons.local_offer_rounded,
          iconColor: Color(0xFFEA580C),
          backgroundColor: Color(0xFFFFF7ED),
        );
      case 'support':
        return const _MetaConfig(
          icon: Icons.support_agent_rounded,
          iconColor: Color(0xFF7C3AED),
          backgroundColor: Color(0xFFF5F3FF),
        );
      default:
        return const _MetaConfig(
          icon: Icons.info_outline_rounded,
          iconColor: Color(0xFF475569),
          backgroundColor: Color(0xFFF1F5F9),
        );
    }
  }
}

class _MetaConfig {
  final IconData icon;
  final Color iconColor;
  final Color backgroundColor;

  const _MetaConfig({
    required this.icon,
    required this.iconColor,
    required this.backgroundColor,
  });
}

