import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_constants.dart';
import '../../core/services/api_service.dart';
import '../../providers/auth_provider.dart';
import '../main_navigation_screen.dart';
import 'change_password_screen.dart';

class UserSessionItem {
  final String id;
  final String device;
  final String browser;
  final String os;
  final String ipAddress;
  final String lastActiveAt;
  final bool isCurrent;

  UserSessionItem({
    required this.id,
    required this.device,
    required this.browser,
    required this.os,
    required this.ipAddress,
    required this.lastActiveAt,
    this.isCurrent = false,
  });

  factory UserSessionItem.fromJson(Map<String, dynamic> json) {
    return UserSessionItem(
      id: (json['id'] ?? json['sessionId'] ?? '').toString(),
      device: (json['device'] ?? 'Device').toString(),
      browser: (json['browser'] ?? 'Browser').toString(),
      os: (json['os'] ?? 'OS').toString(),
      ipAddress: (json['ipAddress'] ?? '127.0.0.1').toString(),
      lastActiveAt: (json['lastActiveAt'] ?? 'Recently').toString(),
      isCurrent: json['isCurrent'] == true,
    );
  }
}

class AccountSecurityScreen extends StatefulWidget {
  final String? userEmail;
  final bool autoFetch;

  const AccountSecurityScreen({
    super.key,
    this.userEmail,
    this.autoFetch = true,
  });

  @override
  State<AccountSecurityScreen> createState() => _AccountSecurityScreenState();
}

class _AccountSecurityScreenState extends State<AccountSecurityScreen> {
  bool _showActiveSessions = false;
  bool _isLoadingSessions = false;
  bool _isLoggingOutAll = false;
  String? _statusBanner;
  bool _isErrorBanner = false;

  List<UserSessionItem> _sessions = [];

  @override
  void initState() {
    super.initState();
    _initDefaultSessions();
    if (widget.autoFetch) {
      _fetchSessions();
    }
  }

  void _initDefaultSessions() {
    _sessions = [
      UserSessionItem(
        id: 'session-curr',
        device: 'HomeCareX Mobile',
        browser: 'Mobile App',
        os: 'Android 16',
        ipAddress: '192.168.1.6',
        lastActiveAt: 'Just now',
        isCurrent: true,
      ),
      UserSessionItem(
        id: 'session-web',
        device: 'Windows Desktop',
        browser: 'Chrome 131',
        os: 'Windows 11',
        ipAddress: '127.0.0.1',
        lastActiveAt: '20 Nov 2026, 11:24 AM',
        isCurrent: false,
      ),
    ];
  }

  Future<void> _fetchSessions() async {
    setState(() => _isLoadingSessions = true);
    try {
      final res = await ApiService.get(ApiConstants.sessions);
      if (res != null && res is Map && res['sessions'] is List) {
        final list = (res['sessions'] as List)
            .map((item) => UserSessionItem.fromJson(item as Map<String, dynamic>))
            .toList();
        if (list.isNotEmpty) {
          setState(() => _sessions = list);
        }
      }
    } catch (_) {
      // Keep default sessions
    } finally {
      if (mounted) setState(() => _isLoadingSessions = false);
    }
  }

  Future<void> _revokeSession(UserSessionItem session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(session.isCurrent ? 'Sign out of this device?' : 'Revoke session?'),
        content: Text(
          session.isCurrent
              ? 'You will be signed out of this mobile session and returned to the login screen.'
              : 'This device (${session.device} · ${session.browser}) will be signed out immediately.',
          style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ApiService.delete('${ApiConstants.sessions}/${session.id}');
      if (session.isCurrent) {
        if (!mounted) return;
        final auth = context.read<AuthProvider>();
        final nav = Navigator.of(context);
        await auth.logout();
        nav.pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainNavigationScreen(initialIndex: 2)),
          (route) => false,
        );
        return;
      }

      setState(() {
        _sessions.removeWhere((s) => s.id == session.id);
        _statusBanner = 'Session revoked successfully.';
        _isErrorBanner = false;
      });
    } catch (e) {
      setState(() {
        _statusBanner = 'Failed to revoke session.';
        _isErrorBanner = true;
      });
    }
  }

  Future<void> _confirmLogoutAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Log out of all devices?'),
        content: const Text(
          'This will terminate all active sessions across every phone, computer, and browser. You will need to sign in again.',
          style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Log Out All'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isLoggingOutAll = true);
    try {
      await ApiService.post(ApiConstants.logoutAll, {});
    } catch (_) {}

    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    final nav = Navigator.of(context);
    await auth.logout();
    nav.pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const MainNavigationScreen(initialIndex: 2)),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final email = widget.userEmail ?? 'tatukulaedukondalu@gmail.com';
    final truncatedEmail = email.length > 20 ? '${email.substring(0, 15)}...' : email;

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
          'Account Security',
          style: TextStyle(
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
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

              // CARD 0: HERO STATUS ("Your Account is Secure")
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEBF3FF), Color(0xFFF0F6FF), Color(0xFFE8F1FD)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFDCE8FC)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withValues(alpha: 0.06),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.2,
                              ),
                              children: [
                                TextSpan(text: 'Your Account is '),
                                TextSpan(
                                  text: 'Secure',
                                  style: TextStyle(color: Color(0xFF2563EB)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Manage your password, review active login sessions, and protect your account.',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: Color(0xFF475569),
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.95),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFDBEAFE)),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF1E1B2E).withValues(alpha: 0.04),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.person_outline_rounded, size: 14, color: Color(0xFF64748B)),
                                const SizedBox(width: 5),
                                Flexible(
                                  child: Text(
                                    'Signed in as $truncatedEmail',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    // 3D Blue Shield Graphic
                    _build3DShield(),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // CARD 1: CHANGE PASSWORD
              Container(
                width: double.infinity,
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
                child: Column(
                  children: [
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChangePasswordScreen(initialEmail: email),
                          ),
                        );
                      },
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Center(
                              child: Icon(Icons.lock_rounded, color: Color(0xFF3B82F6), size: 24),
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Change Password',
                                  style: TextStyle(
                                    fontSize: 15.5,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1E1B2E),
                                  ),
                                ),
                                SizedBox(height: 3),
                                Text(
                                  'Verify your current password to set a new one.',
                                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4F46E5),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ChangePasswordScreen(initialEmail: email),
                            ),
                          );
                        },
                        icon: const Icon(Icons.vpn_key_rounded, size: 17),
                        label: const Text(
                          'Change Password',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // CARD 2: ACTIVE SESSIONS
              Container(
                width: double.infinity,
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
                child: Column(
                  children: [
                    InkWell(
                      onTap: () => setState(() => _showActiveSessions = !_showActiveSessions),
                      borderRadius: BorderRadius.circular(16),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0EEFF),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Center(
                              child: Icon(Icons.devices_rounded, color: Color(0xFF6366F1), size: 24),
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Active Sessions',
                                  style: TextStyle(
                                    fontSize: 15.5,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1E1B2E),
                                  ),
                                ),
                                SizedBox(height: 3),
                                Text(
                                  'Devices currently authenticated with your account.',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            _showActiveSessions
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.chevron_right_rounded,
                            color: const Color(0xFF94A3B8),
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                    if (_showActiveSessions) ...[
                      const SizedBox(height: 14),
                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      const SizedBox(height: 12),
                      if (_isLoadingSessions)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Center(
                            child: CircularProgressIndicator(color: Color(0xFF4F46E5), strokeWidth: 2),
                          ),
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _sessions.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, index) {
                            final session = _sessions[index];
                            final isMobile = session.browser.toLowerCase().contains('mobile') ||
                                session.device.toLowerCase().contains('mobile') ||
                                session.device.toLowerCase().contains('phone');
                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: session.isCurrent
                                    ? const Color(0xFFEEF2FF).withValues(alpha: 0.6)
                                    : const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: session.isCurrent
                                      ? const Color(0xFFC7D2FE)
                                      : const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: session.isCurrent ? const Color(0xFFE0E7FF) : Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Center(
                                      child: Icon(
                                        isMobile ? Icons.smartphone_rounded : Icons.laptop_mac_rounded,
                                        size: 18,
                                        color: session.isCurrent
                                            ? const Color(0xFF4F46E5)
                                            : const Color(0xFF64748B),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                '${session.device} · ${session.browser}',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w600,
                                                  color: Color(0xFF1E1B2E),
                                                ),
                                              ),
                                            ),
                                            if (session.isCurrent)
                                              Container(
                                                margin: const EdgeInsets.only(left: 6),
                                                padding: const EdgeInsets.symmetric(
                                                    horizontal: 7, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFECFDF5),
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: const Text(
                                                  'This device',
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF047857),
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'IP: ${session.ipAddress} • ${session.lastActiveAt}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: Icon(
                                      session.isCurrent ? Icons.logout_rounded : Icons.delete_outline_rounded,
                                      size: 18,
                                      color: session.isCurrent
                                          ? const Color(0xFFD97706)
                                          : const Color(0xFFDC2626),
                                    ),
                                    onPressed: () => _revokeSession(session),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // CARD 3: LOG OUT OF ALL DEVICES
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF5F5),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFFEE2E2)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEF4444).withValues(alpha: 0.04),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Center(
                            child: Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 22),
                          ),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Log Out of All Devices',
                                style: TextStyle(
                                  fontSize: 15.5,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E1B2E),
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Terminate all active sessions across every device, including phone, computer, and browser immediately.',
                                style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEF4444),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: _isLoggingOutAll ? null : _confirmLogoutAll,
                        icon: _isLoggingOutAll
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.logout_rounded, size: 17),
                        label: Text(
                          _isLoggingOutAll ? 'Logging out...' : 'Log Out of All Devices',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  // 3D Metallic/Glossy Shield Widget
  Widget _build3DShield() {
    return Container(
      width: 72,
      height: 78,
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: CustomPaint(
        painter: _Shield3DPainter(),
      ),
    );
  }
}

class _Shield3DPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final path = Path()
      ..moveTo(w * 0.5, 0)
      ..cubicTo(w * 0.85, h * 0.04, w * 0.98, h * 0.18, w * 0.98, h * 0.44)
      ..cubicTo(w * 0.98, h * 0.72, w * 0.65, h * 0.92, w * 0.5, h)
      ..cubicTo(w * 0.35, h * 0.92, w * 0.02, h * 0.72, w * 0.02, h * 0.44)
      ..cubicTo(w * 0.02, h * 0.18, w * 0.15, h * 0.04, w * 0.5, 0)
      ..close();

    // Outer rim gradient
    final rimPaint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFFFFFFF), Color(0xFFBFDBFE), Color(0xFF93C5FD)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(Rect.fromLTWH(0, 0, w, h))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5;

    // Body fill gradient
    final fillPaint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFF3B82F6), Color(0xFF2563EB), Color(0xFF1D4ED8)],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ).createShader(Rect.fromLTWH(0, 0, w, h))
      ..style = PaintingStyle.fill;

    canvas.drawPath(path, fillPaint);
    canvas.drawPath(path, rimPaint);

    // Inner highlight curve
    final highlightPath = Path()
      ..moveTo(w * 0.5, h * 0.06)
      ..cubicTo(w * 0.8, h * 0.1, w * 0.9, h * 0.22, w * 0.9, h * 0.4)
      ..cubicTo(w * 0.7, h * 0.38, w * 0.3, h * 0.38, w * 0.1, h * 0.4)
      ..cubicTo(w * 0.1, h * 0.22, w * 0.2, h * 0.1, w * 0.5, h * 0.06)
      ..close();

    final highlightPaint = Paint()
      ..shader = LinearGradient(
        colors: [Colors.white.withValues(alpha: 0.45), Colors.white.withValues(alpha: 0.0)],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ).createShader(Rect.fromLTWH(0, 0, w, h * 0.45))
      ..style = PaintingStyle.fill;

    canvas.drawPath(highlightPath, highlightPaint);

    // Center Checkmark
    final checkPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final checkPath = Path()
      ..moveTo(w * 0.34, h * 0.48)
      ..lineTo(w * 0.46, h * 0.60)
      ..lineTo(w * 0.68, h * 0.36);

    canvas.drawPath(checkPath, checkPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
