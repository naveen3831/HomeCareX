import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../bookings/bookings_screen.dart';
import '../payments/payments_screen.dart';
import '../referrals/referrals_screen.dart';
import '../reviews/reviews_screen.dart';
import '../support/my_tickets_screen.dart';
import '../wallet/wallet_screen.dart';
import 'account_security_screen.dart';
import 'change_password_screen.dart';
import 'legal_document_screen.dart';
import 'notifications_settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  // Fallback customer details matching web screenshot
  static const String _defaultName = 'TATUKULA EDUKONDALU';
  static const String _defaultEmail = 'tatukulaedukondalu@gmail.com';
  static const String _defaultPhone = '8346167714';

  String _getInitials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'TE';
    if (parts.length == 1) {
      final w = parts[0];
      return (w.length >= 2 ? w.substring(0, 2) : w).toUpperCase();
    }
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    final displayName = (user != null && user.name.trim().isNotEmpty) ? user.name.trim() : _defaultName;
    final displayEmail = (user != null && user.email.trim().isNotEmpty) ? user.email.trim() : _defaultEmail;
    final displayPhone = (user != null && user.phone.trim().isNotEmpty) ? user.phone.trim() : _defaultPhone;
    final initials = _getInitials(displayName);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          physics: const BouncingScrollPhysics(),
          children: [
            // 1. TOP APP BAR: ← Profile
            _buildTopAppBar(context),
            const SizedBox(height: 16),

            // 2. PROFILE HERO CARD (Soft Lavender with Brand Avatar, Details & Edit Profile)
            _buildProfileHero(
              context: context,
              user: user,
              name: displayName,
              email: displayEmail,
              phone: displayPhone,
              initials: initials,
            ),
            const SizedBox(height: 20),

            // 3. BOOKINGS SECTION
            _buildSectionHeader('BOOKINGS'),
            _buildCardGroup(
              children: [
                _buildMenuItem(
                  icon: Icons.calendar_month_outlined,
                  tintBg: const Color(0xFFEEF2FF),
                  tintFg: const Color(0xFF4338CA),
                  title: 'My Bookings',
                  subtitle: 'Upcoming, completed & cancelled',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const BookingsScreen()),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.near_me_outlined,
                  tintBg: const Color(0xFFFFF7ED),
                  tintFg: const Color(0xFFEA580C),
                  title: 'Active Booking',
                  subtitle: 'Track your partner live',
                  badgeText: '1 live',
                  badgeIsLive: true,
                  onTap: () => _showActiveBookingSheet(context),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 4. ACCOUNT SECTION
            _buildSectionHeader('ACCOUNT'),
            _buildCardGroup(
              children: [
                _buildMenuItem(
                  icon: Icons.location_on_outlined,
                  tintBg: const Color(0xFFE0F2FE),
                  tintFg: const Color(0xFF0284C7),
                  title: 'Addresses',
                  subtitle: 'Where we should come',
                  badgeText: '2 saved',
                  onTap: () => _showAddressesSheet(context),
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.shield_outlined,
                  tintBg: const Color(0xFFF3E8FF),
                  tintFg: const Color(0xFF7C3AED),
                  title: 'Account Security',
                  subtitle: 'Password, sessions & devices',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => AccountSecurityScreen(
                          userEmail: displayEmail,
                        ),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.lock_outline_rounded,
                  tintBg: const Color(0xFFFFF7ED),
                  tintFg: const Color(0xFFEA580C),
                  title: 'Change password',
                  subtitle: 'Keep your account secure',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ChangePasswordScreen(
                          initialEmail: displayEmail,
                        ),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.notifications_none_rounded,
                  tintBg: const Color(0xFFFFF1F2),
                  tintFg: const Color(0xFFE11D48),
                  title: 'Notifications',
                  subtitle: 'Choose alerts & your language',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const NotificationsSettingsScreen(),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.credit_card_outlined,
                  tintBg: const Color(0xFFECFDF5),
                  tintFg: const Color(0xFF059669),
                  title: 'Payments',
                  subtitle: 'Payment methods & receipts',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const PaymentsScreen(),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.account_balance_wallet_outlined,
                  tintBg: const Color(0xFFFEF3C7),
                  tintFg: const Color(0xFFD97706),
                  title: 'Wallet',
                  subtitle: 'Balance & cashback',
                  badgeText: '₹250',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const WalletScreen(),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.star_outline_rounded,
                  tintBg: const Color(0xFFFFE4E6),
                  tintFg: const Color(0xFFE11D48),
                  title: 'Reviews',
                  subtitle: 'Your ratings & feedback',
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ReviewsScreen(),
                      ),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 5. SUPPORT SECTION
            _buildSectionHeader('SUPPORT'),
            _buildCardGroup(
              children: [
                _buildMenuItem(
                  icon: Icons.help_outline_rounded,
                  tintBg: const Color(0xFFE0F2FE),
                  tintFg: const Color(0xFF0284C7),
                  title: 'Help Center',
                  subtitle: 'FAQs & contact support',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const MyTicketsScreen(initialTab: 0),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.confirmation_number_outlined,
                  tintBg: const Color(0xFFEEF2FF),
                  tintFg: const Color(0xFF4338CA),
                  title: 'My Tickets',
                  subtitle: 'Your support requests',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const MyTicketsScreen(initialTab: 1),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.card_giftcard_rounded,
                  tintBg: const Color(0xFFF3E8FF),
                  tintFg: const Color(0xFF7C3AED),
                  title: 'Referrals',
                  subtitle: 'Invite friends, earn rewards',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ReferralsScreen(),
                      ),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 6. LEGAL SECTION
            _buildSectionHeader('LEGAL'),
            _buildCardGroup(
              children: [
                _buildMenuItem(
                  icon: Icons.article_outlined,
                  tintBg: const Color(0xFFEEF2FF),
                  tintFg: const Color(0xFF4338CA),
                  title: 'Terms & Conditions',
                  subtitle: 'Read the rules for using HomeCareX',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => LegalDocumentScreen.terms(),
                      ),
                    );
                  },
                ),
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.verified_user_outlined,
                  tintBg: const Color(0xFFECFDF5),
                  tintFg: const Color(0xFF059669),
                  title: 'Privacy Policy',
                  subtitle: 'How we handle your data',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => LegalDocumentScreen.privacy(),
                      ),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 7. SIGN OUT CARD
            _buildCardGroup(
              children: [
                InkWell(
                  onTap: () => _handleLogout(context, auth),
                  borderRadius: BorderRadius.circular(22),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.logout_rounded,
                              size: 20,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Text(
                            'Log out',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          size: 20,
                          color: Color(0xFFDC2626),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // 8. APP FOOTER
            const Center(
              child: Text(
                'HomeCareX v1.0.0 • Verified Home Professionals',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ),
            const SizedBox(height: 88),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // TOP APP BAR (← Profile)
  // --------------------------------------------------------------------------
  Widget _buildTopAppBar(BuildContext context) {
    return GestureDetector(
      onTap: () {
        if (Navigator.canPop(context)) {
          Navigator.pop(context);
        }
      },
      child: const Padding(
        padding: EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.arrow_back_rounded,
              size: 20,
              color: Color(0xFF1E1B2E),
            ),
            SizedBox(width: 8),
            Text(
              'Profile',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E1B2E),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PROFILE HERO CARD (Soft Lavender container with Brand Avatar & Edit Profile)
  // --------------------------------------------------------------------------
  Widget _buildProfileHero({
    required BuildContext context,
    required UserModel? user,
    required String name,
    required String email,
    required String phone,
    required String initials,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFE9EBFF),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFD9DCF7), width: 1.2),
      ),
      padding: const EdgeInsets.all(18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Circular Avatar with white border and camera badge
          SizedBox(
            width: 72,
            height: 72,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Avatar circle
                Container(
                  width: 66,
                  height: 66,
                  decoration: BoxDecoration(
                    color: const Color(0xFF4338CA),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF4338CA).withValues(alpha: 0.18),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Center(
                    child: (user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
                        ? ClipOval(
                            child: Image.network(
                              user.avatarUrl!,
                              width: 60,
                              height: 60,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Text(
                                initials,
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          )
                        : Text(
                            initials,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 0.5,
                            ),
                          ),
                  ),
                ),

                // Camera badge at bottom-right corner
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: GestureDetector(
                    onTap: () => _showPhotoOptions(context),
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFD9DCF7), width: 1),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF1E1B2E).withValues(alpha: 0.14),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.camera_alt_rounded,
                          size: 13,
                          color: Color(0xFF4338CA),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),

          // User details and Edit profile button
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E1B2E),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),

                // Email
                Text(
                  email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w400,
                  ),
                ),

                // Phone
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: 1),
                  Text(
                    phone,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ],
                const SizedBox(height: 8),

                // Edit profile pill button
                GestureDetector(
                  onTap: () => _showEditProfileDialog(context, name, email, phone),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE9EBFF),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFB9BFF2), width: 1.4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.mode_edit_outline_rounded,
                          size: 13,
                          color: Color(0xFF4338CA),
                        ),
                        SizedBox(width: 5),
                        Text(
                          'Edit profile',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF4338CA),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // SECTION HEADER
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // CARD GROUP (iOS-style white card container)
  // --------------------------------------------------------------------------
  Widget _buildCardGroup({required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1E1B2E).withValues(alpha: 0.05),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Column(
          children: children,
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // DIVIDER (indented to match icon margin)
  // --------------------------------------------------------------------------
  Widget _buildDivider() {
    return const Divider(
      height: 1,
      thickness: 1,
      color: Color(0xFFF1F5F9),
      indent: 70,
    );
  }

  // --------------------------------------------------------------------------
  // MENU ITEM ROW
  // --------------------------------------------------------------------------
  Widget _buildMenuItem({
    required IconData icon,
    required Color tintBg,
    required Color tintFg,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    String? badgeText,
    bool badgeIsLive = false,
  }) {
    return InkWell(
      onTap: onTap,
      splashColor: const Color(0xFFF8FAFC),
      highlightColor: const Color(0xFFF1F5F9),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            // Tinted Icon Container (44x44, rounded 14)
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: tintBg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Icon(
                  icon,
                  size: 20,
                  color: tintFg,
                ),
              ),
            ),
            const SizedBox(width: 14),

            // Title and Subtitle
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E1B2E),
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),

            // Optional Badge Pill (e.g., "1 live" or "2 saved")
            if (badgeText != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                decoration: BoxDecoration(
                  color: badgeIsLive ? const Color(0xFFECFDF5) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (badgeIsLive) ...[
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Color(0xFF10B981),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    Text(
                      badgeText,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: badgeIsLive ? const Color(0xFF047857) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
            ],

            // Chevron Right
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: Color(0xFF94A3B8),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // MODALS & ACTIONS
  // --------------------------------------------------------------------------

  void _showPhotoOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Change Profile Photo',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E1B2E)),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined, color: Color(0xFF4338CA)),
                title: const Text('Take a photo'),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Camera opened.')),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined, color: Color(0xFF4338CA)),
                title: const Text('Choose from gallery'),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Gallery opened.')),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
                title: const Text('Remove current photo', style: TextStyle(color: Color(0xFFDC2626))),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Profile photo reset to initials.')),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEditProfileDialog(BuildContext context, String currentName, String currentEmail, String currentPhone) {
    final nameCtrl = TextEditingController(text: currentName);
    final emailCtrl = TextEditingController(text: currentEmail);
    final phoneCtrl = TextEditingController(text: currentPhone);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Edit Profile',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E1B2E)),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameCtrl,
              decoration: InputDecoration(
                labelText: 'Full Name',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              decoration: InputDecoration(
                labelText: 'Email Address',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              decoration: InputDecoration(
                labelText: 'Phone Number',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Profile updated successfully!')),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4338CA),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showActiveBookingSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.near_me_outlined, color: Color(0xFFEA580C), size: 26),
              ),
              const SizedBox(height: 14),
              const Text(
                'Live Service Partner Tracking',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E1B2E)),
              ),
              const SizedBox(height: 6),
              const Text(
                'Partner Rajesh Kumar is on his way for Kitchen Deep Cleaning.\nEstimated arrival in 15 mins.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const BookingsScreen()),
                    );
                  },
                  icon: const Icon(Icons.navigation_rounded, size: 18),
                  label: const Text('View Booking Details'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4338CA),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddressesSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Saved Addresses',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E1B2E)),
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.home_outlined, color: Color(0xFF0284C7)),
                ),
                title: const Text('Home', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Flat 402, Green Valley Apartments, Bengaluru'),
                trailing: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981)),
              ),
              const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.business_outlined, color: Color(0xFF64748B)),
                ),
                title: const Text('Office', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: const Text('Tower B, Indiranagar Tech Park, Bengaluru'),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Add address dialog opened.')),
                    );
                  },
                  icon: const Icon(Icons.add_rounded, size: 20),
                  label: const Text('Add New Address'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF4338CA),
                    side: const BorderSide(color: Color(0xFF4338CA)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }















  Future<void> _handleLogout(BuildContext context, AuthProvider auth) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Log Out', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to log out of HomeCareX?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await auth.logout();
      if (context.mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }
}
