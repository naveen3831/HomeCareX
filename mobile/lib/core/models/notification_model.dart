class NotificationModel {
  final String id;
  final String? userId;
  final String type;
  final String group; // 'booking', 'payment', 'partner', 'offers', 'support', 'system'
  final String title;
  final String message;
  final Map<String, dynamic>? payload;
  final DateTime? readAt;
  final DateTime createdAt;

  NotificationModel({
    required this.id,
    this.userId,
    required this.type,
    required this.group,
    required this.title,
    required this.message,
    this.payload,
    this.readAt,
    required this.createdAt,
  });

  bool get isRead => readAt != null;
  bool get isUnread => readAt == null;

  NotificationModel copyWith({
    String? id,
    String? userId,
    String? type,
    String? group,
    String? title,
    String? message,
    Map<String, dynamic>? payload,
    DateTime? readAt,
    DateTime? createdAt,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      group: group ?? this.group,
      title: title ?? this.title,
      message: message ?? this.message,
      payload: payload ?? this.payload,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  String get timeAgo {
    final now = DateTime.now();
    final diff = now.difference(createdAt);
    if (diff.inSeconds < 60) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes} min ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} h ago';
    } else if (diff.inDays == 1) {
      return 'Yesterday';
    } else if (diff.inDays < 7) {
      return '${diff.inDays} d ago';
    } else {
      return '${createdAt.day}/${createdAt.month}/${createdAt.year}';
    }
  }

  String get dayBucket {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final itemDate = DateTime(createdAt.year, createdAt.month, createdAt.day);
    final diffDays = today.difference(itemDate).inDays;
    if (diffDays <= 0) return 'TODAY';
    if (diffDays == 1) return 'YESTERDAY';
    return 'EARLIER';
  }

  static String resolveGroup(String type, [String? explicitGroup]) {
    if (explicitGroup != null && explicitGroup.trim().isNotEmpty) {
      return explicitGroup.trim().toLowerCase();
    }
    final prefix = type.split('.').first.toLowerCase();
    switch (prefix) {
      case 'booking':
        return 'booking';
      case 'payment':
      case 'payout':
      case 'refund':
        return 'payment';
      case 'partner':
        return 'partner';
      case 'offer':
      case 'offers':
        return 'offers';
      case 'ticket':
      case 'support':
        return 'support';
      default:
        return 'system';
    }
  }

  static Map<String, String> describeType(String type, [Map<String, dynamic>? payload]) {
    final ownTitle = payload?['title']?.toString();
    final ownMessage = payload?['message']?.toString();

    String title;
    String message;

    switch (type) {
      case 'payment.succeeded':
        title = 'Payment successful';
        message = 'Payment received. Your booking is confirmed';
        break;
      case 'payment.failed':
        title = 'Payment failed';
        message = 'Your payment didn\'t go through. You can try again from the booking.';
        break;
      case 'booking.created':
        title = 'Booking placed';
        message = 'We\'ve received your booking and are finding the right partner.';
        break;
      case 'booking.confirmed':
        title = 'Booking confirmed';
        message = 'Your booking is confirmed.';
        break;
      case 'booking.assigned':
        title = 'Partner assigned';
        message = 'A partner has been assigned to your booking.';
        break;
      case 'booking.cancelled':
        title = 'Booking cancelled';
        message = 'Your booking was cancelled.';
        break;
      case 'booking.completed':
        title = 'Service completed';
        message = 'How did it go? Rate your service to help others.';
        break;
      case 'partner.approved':
        title = 'Partner update';
        message = 'Your partner has been confirmed.';
        break;
      case 'partner.rejected':
        title = 'Partner update';
        message = 'Your partner couldn\'t take this job. We\'re finding another one.';
        break;
      case 'offer.new':
        title = 'New offer';
        message = 'A new offer is available for you.';
        break;
      case 'ticket.reply':
        title = 'Support replied';
        message = 'Our team replied to your support ticket.';
        break;
      case 'system.announcement':
        title = 'Announcement';
        message = 'There\'s an update from HomeCareX.';
        break;
      default:
        final clean = type.replaceAll(RegExp(r'[._]+'), ' ').trim();
        title = clean.isNotEmpty ? clean[0].toUpperCase() + clean.substring(1) : 'Notification';
        message = 'Open the app for details.';
    }

    return {
      'title': ownTitle != null && ownTitle.trim().isNotEmpty ? ownTitle : title,
      'message': ownMessage != null && ownMessage.trim().isNotEmpty ? ownMessage : message,
    };
  }

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final id = (json['id'] ?? json['_id'] ?? '').toString();
    final type = (json['type'] ?? 'system.announcement').toString();
    final group = resolveGroup(type, json['group']?.toString());
    final payload = json['payload'] is Map<String, dynamic>
        ? json['payload'] as Map<String, dynamic>
        : (json['payload'] is Map ? Map<String, dynamic>.from(json['payload'] as Map) : null);

    final desc = describeType(type, payload);
    final title = (json['title']?.toString().trim().isNotEmpty == true)
        ? json['title'].toString()
        : desc['title']!;
    final message = (json['message']?.toString().trim().isNotEmpty == true)
        ? json['message'].toString()
        : desc['message']!;

    DateTime parsedCreatedAt = DateTime.now();
    if (json['createdAt'] != null) {
      parsedCreatedAt = DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now();
    }

    DateTime? parsedReadAt;
    if (json['readAt'] != null) {
      parsedReadAt = DateTime.tryParse(json['readAt'].toString());
    }

    return NotificationModel(
      id: id,
      userId: json['userId']?.toString(),
      type: type,
      group: group,
      title: title,
      message: message,
      payload: payload,
      readAt: parsedReadAt,
      createdAt: parsedCreatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'type': type,
      'group': group,
      'title': title,
      'message': message,
      'payload': payload,
      'readAt': readAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

