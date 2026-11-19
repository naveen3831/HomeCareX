import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/api_service.dart';
import '../../providers/auth_provider.dart';

class ReferralsScreen extends StatefulWidget {
  const ReferralsScreen({super.key});

  @override
  State<ReferralsScreen> createState() => _ReferralsScreenState();
}

class _ReferralsScreenState extends State<ReferralsScreen> {
  int _friendsInvited = 0;
  int _firstBookingsCompleted = 0;
  double _walletRewardsCredited = 0.0;
  List<dynamic> _entries = [];

  @override
  void initState() {
    super.initState();
    _fetchReferrals();
  }

  Future<void> _fetchReferrals() async {
    try {
      final res = await ApiService.get(ApiConstants.referrals);
      if (res is Map<String, dynamic> && mounted) {
        final stats = res['stats'];
        if (stats is Map<String, dynamic>) {
          setState(() {
            _friendsInvited = stats['invited'] ?? 0;
            _firstBookingsCompleted = stats['completed'] ?? 0;
            final paise = stats['rewardsPaise'] ?? 0;
            _walletRewardsCredited = (paise is num ? paise / 100 : 0.0);
          });
        }
        if (res['entries'] is List) {
          setState(() {
            _entries = res['entries'];
          });
        }
      }
    } catch (_) {
      // Fallback seeds when offline or no entries
    }
  }

  void _copyToClipboard(String text, String message) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xFF1E1B2E),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _shareInvite(String code) {
    final shareUrl = 'https://homecarex.com/register?ref=$code';
    final shareText =
        'Join me on HomeCareX! Use my referral code $code when signing up: $shareUrl';

    // Show a share options dialog
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Share Invite',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E1B2E),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pop(ctx),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF1F5F9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Share your personal referral link with family and friends.',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 20),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: Color(0xFF2E7D32),
                    size: 22,
                  ),
                ),
                title: const Text(
                  'Share via WhatsApp',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
                subtitle: const Text(
                  'Send direct message to contacts',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFF94A3B8),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _copyToClipboard(shareText, 'Invite text copied for WhatsApp!');
                },
              ),
              const Divider(color: Color(0xFFF1F5F9)),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEECFB),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.link_rounded,
                    color: AppColors.brand,
                    size: 22,
                  ),
                ),
                title: const Text(
                  'Copy Referral Link',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
                subtitle: Text(
                  shareUrl,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                trailing: const Icon(
                  Icons.copy_rounded,
                  size: 18,
                  color: Color(0xFF94A3B8),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _copyToClipboard(shareUrl, 'Referral link copied to clipboard!');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final referralCode = (user?.referralCode != null &&
            user!.referralCode!.trim().isNotEmpty)
        ? user.referralCode!.trim().toUpperCase()
        : 'HCXTATUKULA';

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_rounded,
            color: Color(0xFF1E1B2E),
            size: 22,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: const Text(
          'Referrals',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1B2E),
          ),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchReferrals,
          color: AppColors.brand,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. HERO HEADER CARD (Peach Gradient)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFF0DF), Color(0xFFFFFAF4)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFF4DFCA)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF0E1),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFEFC7A4)),
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.card_giftcard_rounded,
                            color: Color(0xFFC2410C),
                            size: 26,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'SHARE A LITTLE HOME CARE',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                                color: Color(0xFFC2410C),
                              ),
                            ),
                            SizedBox(height: 5),
                            Text(
                              'Friends. Home care.\nRewards.',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF1E1B2E),
                                height: 1.25,
                              ),
                            ),
                            SizedBox(height: 6),
                            Text(
                              'Invite friends and follow their first booking milestones.',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF655B50),
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // 2. REFERRAL STATS ROW (3 Cards)
                Row(
                  children: [
                    Expanded(
                      child: _buildStatCard(
                        value: '$_friendsInvited',
                        label: 'Friends invited',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildStatCard(
                        value: '$_firstBookingsCompleted',
                        label: 'First bookings completed',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildStatCard(
                        value: '₹${_walletRewardsCredited.toStringAsFixed(2)}',
                        label: 'Wallet reward credited',
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // 3. INVITE A FRIEND PANEL
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1E1B2E).withValues(alpha: 0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'A GOOD THING TO SHARE',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: Color(0xFFC2410C),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Invite a friend to HomeCareX',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E1B2E),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Your referral code',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Referral Code Display Field
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFBF6),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFFF4DFCA),
                            width: 1.2,
                          ),
                        ),
                        child: Text(
                          referralCode,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.4,
                            color: Color(0xFF1E1B2E),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Primary Buttons: Copy Code + Share Invite
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _copyToClipboard(
                                referralCode,
                                'Referral code $referralCode copied to clipboard!',
                              ),
                              icon: const Icon(
                                Icons.copy_rounded,
                                size: 16,
                                color: Color(0xFF1E1B2E),
                              ),
                              label: const Text(
                                'Copy code',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1E1B2E),
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                backgroundColor: Colors.white,
                                side: const BorderSide(
                                  color: Color(0xFFE2E8F0),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () => _shareInvite(referralCode),
                              icon: const Icon(
                                Icons.share_rounded,
                                size: 16,
                                color: Colors.white,
                              ),
                              label: const Text(
                                'Share invite',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFC2410C),
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 10),

                      // Secondary Buttons: WhatsApp + Copy Link
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                final shareText =
                                    'Join me on HomeCareX! Use my referral code $referralCode: https://homecarex.com/register?ref=$referralCode';
                                _copyToClipboard(
                                  shareText,
                                  'Invite message copied! Ready to send on WhatsApp.',
                                );
                              },
                              icon: const Icon(
                                Icons.chat_bubble_outline_rounded,
                                size: 16,
                                color: Color(0xFF16A34A),
                              ),
                              label: const Text(
                                'WhatsApp',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF16A34A),
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                backgroundColor: const Color(0xFFF0FDF4),
                                side: const BorderSide(
                                  color: Color(0xFFBBF7D0),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 11),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                final link =
                                    'https://homecarex.com/register?ref=$referralCode';
                                _copyToClipboard(
                                  link,
                                  'Referral link copied to clipboard!',
                                );
                              },
                              icon: const Icon(
                                Icons.link_rounded,
                                size: 16,
                                color: Color(0xFF64748B),
                              ),
                              label: const Text(
                                'Copy link',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                backgroundColor: Colors.white,
                                side: const BorderSide(
                                  color: Color(0xFFE2E8F0),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 11),
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),
                      const Text(
                        '₹50 is credited to your wallet after your friend’s first paid booking. Each friend can earn one referral reward.',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF64748B),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // 4. REFERRAL ACTIVITY
                const Text(
                  'Referral activity',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E1B2E),
                  ),
                ),
                const SizedBox(height: 10),

                if (_entries.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 30,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF1E1B2E).withValues(alpha: 0.02),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFFF0DF),
                            shape: BoxShape.circle,
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.people_outline_rounded,
                              size: 24,
                              color: Color(0xFFC2410C),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Your first invitation starts here',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1E1B2E),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Share your code with a friend. Their sign-up will appear here.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12.5,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _entries.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, idx) {
                      final item = _entries[idx];
                      final name = item['friendName'] ??
                          item['referee']?['name'] ??
                          'Friend #${idx + 1}';
                      final status = item['status'] ?? 'invited';
                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: const Color(0xFFEEECFB),
                              child: Text(
                                name.isNotEmpty ? name[0].toUpperCase() : 'F',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.brand,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    status == 'rewarded'
                                        ? 'Reward credited'
                                        : 'Awaiting first booking',
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({required String value, required String label}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 17.5,
              fontWeight: FontWeight.w800,
              color: Color(0xFFC2410C),
              height: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF64748B),
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}
