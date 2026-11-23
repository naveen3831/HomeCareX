import 'package:flutter/material.dart';
import '../core/models/notification_model.dart';
import '../core/services/api_service.dart';
import '../core/constants/api_constants.dart';
import '../core/services/storage_service.dart';

class NotificationProvider extends ChangeNotifier {
  List<NotificationModel> _notifications = _generateDefaultSeeds();
  String _selectedGroup = 'all';
  bool _isLoading = false;
  String? _errorMessage;
  bool syncRemote = true;

  NotificationProvider() {
    _initializeNotifications();
  }

  List<NotificationModel> get notifications => _notifications;
  String get selectedGroup => _selectedGroup;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  int get unreadCount => _notifications.where((n) => n.isUnread).length;

  int countForGroup(String group) {
    if (group == 'all') {
      return unreadCount;
    }
    return _notifications.where((n) => n.group == group && n.isUnread).length;
  }

  List<NotificationModel> get filteredNotifications {
    if (_selectedGroup == 'all') {
      return List.unmodifiable(_notifications);
    }
    return _notifications.where((n) => n.group == _selectedGroup).toList();
  }

  Map<String, List<NotificationModel>> get groupedNotifications {
    final filtered = filteredNotifications;
    final map = <String, List<NotificationModel>>{
      'TODAY': [],
      'YESTERDAY': [],
      'EARLIER': [],
    };

    for (final item in filtered) {
      final bucket = item.dayBucket;
      if (map.containsKey(bucket)) {
        map[bucket]!.add(item);
      } else {
        map['EARLIER']!.add(item);
      }
    }

    // Remove empty buckets
    map.removeWhere((key, value) => value.isEmpty);
    return map;
  }

  static List<NotificationModel> _generateDefaultSeeds() {
    final now = DateTime.now();
    return [
      NotificationModel(
        id: 'seed-notif-1',
        type: 'payment.succeeded',
        group: 'payment',
        title: 'Payment successful',
        message: 'Payment received. Your booking is confirmed',
        createdAt: now.subtract(const Duration(minutes: 29)),
      ),
      NotificationModel(
        id: 'seed-notif-2',
        type: 'booking.assigned',
        group: 'booking',
        title: 'Partner assigned',
        message: 'A partner has been assigned to your booking',
        createdAt: now.subtract(const Duration(hours: 1)),
      ),
    ];
  }

  bool _isInitialized = false;

  Future<void> _initializeNotifications() async {
    if (!syncRemote) return;
    if (_isInitialized) return;
    _isInitialized = true;
    try {
      final cached = await StorageService.getNotifications();
      if (cached.isNotEmpty) {
        _notifications = cached.map((n) => NotificationModel.fromJson(n)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[NotificationProvider] init error: $e');
    }
  }

  Future<void> _persistNotifications() async {
    try {
      await StorageService.saveNotifications(_notifications.map((n) => n.toJson()).toList());
    } catch (e) {
      debugPrint('[NotificationProvider] persist error: $e');
    }
  }

  void selectGroup(String group) {
    if (_selectedGroup != group) {
      _selectedGroup = group;
      notifyListeners();
    }
  }

  Future<void> fetchNotifications() async {
    if (!syncRemote) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.customerNotifications);
      if (res is List && res.isNotEmpty) {
        _notifications = res
            .map((item) => NotificationModel.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList();
        await _persistNotifications();
      }
    } catch (e) {
      debugPrint('[NotificationProvider] fetchNotifications error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> markAsRead(String id) async {
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index != -1) {
      _notifications[index] = _notifications[index].copyWith(readAt: DateTime.now());
      notifyListeners();
      await _persistNotifications();

      if (syncRemote) {
        try {
          await ApiService.patch('${ApiConstants.customerNotifications}/$id/read', {});
        } catch (e) {
          debugPrint('[NotificationProvider] markAsRead remote error: $e');
        }
      }
    }
  }

  Future<void> markAllRead() async {
    final now = DateTime.now();
    bool changed = false;
    for (int i = 0; i < _notifications.length; i++) {
      if (_notifications[i].isUnread) {
        _notifications[i] = _notifications[i].copyWith(readAt: now);
        changed = true;
      }
    }

    if (changed) {
      notifyListeners();
      await _persistNotifications();

      if (syncRemote) {
        try {
          await ApiService.patch('${ApiConstants.customerNotifications}/read-all', {});
        } catch (e) {
          debugPrint('[NotificationProvider] markAllRead remote error: $e');
        }
      }
    }
  }

  Future<void> deleteNotification(String id) async {
    _notifications.removeWhere((n) => n.id == id);
    notifyListeners();
    await _persistNotifications();

    if (syncRemote) {
      try {
        await ApiService.delete('${ApiConstants.customerNotifications}/$id');
      } catch (e) {
        debugPrint('[NotificationProvider] deleteNotification remote error: $e');
      }
    }
  }

  Future<void> addNotification(NotificationModel notification) async {
    _notifications.insert(0, notification);
    notifyListeners();
    await _persistNotifications();
  }

  Future<void> deleteAll() async {
    _notifications.clear();
    notifyListeners();
    await _persistNotifications();

    if (syncRemote) {
      try {
        await ApiService.delete(ApiConstants.customerNotifications);
      } catch (e) {
        debugPrint('[NotificationProvider] deleteAll remote error: $e');
      }
    }
  }
}

