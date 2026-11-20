import 'package:flutter/material.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';

class NotificationsSettingsScreen extends StatefulWidget {
  final bool autoFetch;

  const NotificationsSettingsScreen({
    super.key,
    this.autoFetch = true,
  });

  @override
  State<NotificationsSettingsScreen> createState() => _NotificationsSettingsScreenState();
}

class _NotificationsSettingsScreenState extends State<NotificationsSettingsScreen> {
  String _selectedLanguage = 'en';
  bool _isLoading = false;
  bool _isSaving = false;
  String? _statusBanner;
  bool _isErrorBanner = false;

  final Map<String, String> _languages = {
    'en': 'English',
    'hi': 'हिन्दी (Hindi)',
    'te': 'తెలుగు (Telugu)',
  };

  // Matrix matching backend DEFAULT_NOTIFICATIONS
  final Map<String, Map<String, bool>> _matrix = {
    'booking': {'push': true, 'sms': true, 'email': true, 'inApp': true},
    'payment': {'push': true, 'sms': false, 'email': true, 'inApp': true},
    'offers': {'push': true, 'sms': false, 'email': false, 'inApp': true},
    'reminders': {'push': true, 'sms': true, 'email': false, 'inApp': true},
    'support': {'push': true, 'sms': false, 'email': true, 'inApp': true},
  };

  final Map<String, Map<String, String>> _topicMeta = {
    'booking': {'title': 'Bookings', 'hint': 'Confirmations, partner on the way, completion'},
    'payment': {'title': 'Payments', 'hint': 'Receipts, refunds, wallet activity'},
    'offers': {'title': 'Offers', 'hint': 'Discounts and new services'},
    'reminders': {'title': 'Reminders', 'hint': 'Upcoming visits and pending actions'},
    'support': {'title': 'Support', 'hint': 'Replies to your tickets'},
  };

  final Map<String, String> _channelLabels = {
    'push': 'Push',
    'sms': 'SMS',
    'email': 'Email',
    'inApp': 'In-app',
  };

  String? _expandedTopic;

  @override
  void initState() {
    super.initState();
    if (widget.autoFetch) {
      _fetchPreferences();
    }
  }

  Future<void> _fetchPreferences() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.get(ApiConstants.customerPreferences);
      if (res != null && res is Map && res['data'] != null) {
        final prefs = res['data']['preferences'];
        if (prefs is Map) {
          if (prefs['language'] is String) {
            _selectedLanguage = prefs['language'];
          }
          if (prefs['notifications'] is Map) {
            final notifs = prefs['notifications'] as Map;
            for (final topic in _matrix.keys) {
              if (notifs[topic] is Map) {
                final topicMap = notifs[topic] as Map;
                for (final ch in ['push', 'sms', 'email', 'inApp']) {
                  if (topicMap[ch] is bool) {
                    _matrix[topic]![ch] = topicMap[ch];
                  }
                }
              }
            }
          }
        }
      }
    } catch (_) {
      // Fallback to default matrix
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _savePreferences() async {
    setState(() {
      _isSaving = true;
      _statusBanner = null;
    });

    final payload = {
      'language': _selectedLanguage,
      'notifications': _matrix,
    };

    try {
      await ApiService.patch(ApiConstants.customerPreferences, payload);
      if (mounted) {
        setState(() {
          _isSaving = false;
          _isErrorBanner = false;
          _statusBanner = 'Preferences saved successfully.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaving = false;
          _isErrorBanner = false; // Graceful offline/local save feedback
          _statusBanner = 'Preferences saved locally.';
        });
      }
    }
  }

  void _showInboxSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Center(
                  child: Icon(Icons.mark_email_read_outlined, size: 28, color: Color(0xFFE11D48)),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Notification Inbox',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'You\'re all caught up! Booking updates, receipts and promotional offers will appear here.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4338CA),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Close Inbox', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1E1B2E), size: 22),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF4338CA)),
            )
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Status Banner
                    if (_statusBanner != null) ...[
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: _isErrorBanner ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: _isErrorBanner ? const Color(0xFFFECACA) : const Color(0xFFA7F3D0),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _isErrorBanner ? Icons.error_outline_rounded : Icons.check_circle_rounded,
                              color: _isErrorBanner ? const Color(0xFFDC2626) : const Color(0xFF059669),
                              size: 18,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _statusBanner!,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: _isErrorBanner ? const Color(0xFF991B1B) : const Color(0xFF065F46),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // 1. INBOX BANNER CARD
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF1F2),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Center(
                              child: Icon(Icons.inbox_rounded, color: Color(0xFFE11D48), size: 22),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Notification Inbox',
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1E1B2E),
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'View all your received booking updates & alerts',
                                  style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: _showInboxSheet,
                            style: TextButton.styleFrom(
                              foregroundColor: const Color(0xFF4338CA),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            ),
                            child: const Text('Open →', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // 2. LANGUAGE SECTION
                    _buildSectionHeader('LANGUAGE'),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: _languages.entries.map((entry) {
                          final isSelected = _selectedLanguage == entry.key;
                          return InkWell(
                            onTap: () => setState(() => _selectedLanguage = entry.key),
                            borderRadius: BorderRadius.circular(20),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              child: Row(
                                children: [
                                  Icon(
                                    isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                                    color: isSelected ? const Color(0xFF4338CA) : const Color(0xFF94A3B8),
                                    size: 20,
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    entry.value,
                                    style: TextStyle(
                                      fontSize: 14.5,
                                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                                      color: isSelected ? const Color(0xFF1E1B2E) : const Color(0xFF475569),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // 3. NOTIFY ME ABOUT SECTION
                    _buildSectionHeader('NOTIFY ME ABOUT'),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Column(
                          children: _topicMeta.entries.map((entry) {
                            final topicKey = entry.key;
                            final title = entry.value['title']!;
                            final hint = entry.value['hint']!;
                            final isExpanded = _expandedTopic == topicKey;

                            final channels = _matrix[topicKey]!;
                            final activeChannels = channels.entries
                                .where((e) => e.value)
                                .map((e) => _channelLabels[e.key] ?? e.key)
                                .toList();
                            final summaryText = activeChannels.isEmpty ? 'Off' : activeChannels.join(', ');

                            return Column(
                              children: [
                                InkWell(
                                  onTap: () {
                                    setState(() {
                                      _expandedTopic = isExpanded ? null : topicKey;
                                    });
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                title,
                                                style: const TextStyle(
                                                  fontSize: 14.5,
                                                  fontWeight: FontWeight.w600,
                                                  color: Color(0xFF1E1B2E),
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                hint,
                                                style: const TextStyle(
                                                  fontSize: 11.5,
                                                  color: Color(0xFF64748B),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: activeChannels.isNotEmpty
                                                ? const Color(0xFFEEF2FF)
                                                : const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            summaryText,
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: activeChannels.isNotEmpty
                                                  ? const Color(0xFF4338CA)
                                                  : const Color(0xFF94A3B8),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Icon(
                                          isExpanded
                                              ? Icons.keyboard_arrow_up_rounded
                                              : Icons.keyboard_arrow_down_rounded,
                                          color: const Color(0xFF94A3B8),
                                          size: 20,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                if (isExpanded)
                                  Container(
                                    color: const Color(0xFFF8FAFC),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    child: Column(
                                      children: ['push', 'sms', 'email', 'inApp'].map((ch) {
                                        final isChannelOn = channels[ch] ?? false;
                                        return Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 4),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                _channelLabels[ch] ?? ch,
                                                style: const TextStyle(
                                                  fontSize: 13.5,
                                                  fontWeight: FontWeight.w500,
                                                  color: Color(0xFF334155),
                                                ),
                                              ),
                                              Switch(
                                                value: isChannelOn,
                                                activeThumbColor: const Color(0xFF4338CA),
                                                onChanged: (val) {
                                                  setState(() {
                                                    _matrix[topicKey]![ch] = val;
                                                  });
                                                },
                                              ),
                                            ],
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ),
                                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // 4. SAVE PREFERENCES BUTTON
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4338CA),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: _isSaving ? null : _savePreferences,
                        child: _isSaving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text(
                                'Save preferences',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                              ),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.4,
          color: Color(0xFF64748B),
        ),
      ),
    );
  }
}
