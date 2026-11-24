import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../main_navigation_screen.dart';
import '../bookings/active_bookings_screen.dart';
import '../bookings/bookings_screen.dart';
import '../onboarding/onboarding_screen.dart';
import '../payments/payments_screen.dart';
import '../referrals/referrals_screen.dart';
import '../reviews/reviews_screen.dart';
import '../support/my_tickets_screen.dart';
import '../wallet/wallet_screen.dart';
import 'account_security_screen.dart';
import 'change_password_screen.dart';
import 'edit_profile_screen.dart';
import 'legal_document_screen.dart';
import 'notifications_settings_screen.dart';
import 'saved_addresses_screen.dart';

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
    final isAuthenticated = auth.isAuthenticated;
    final user = auth.user;

    final displayName = (user != null && user.name.trim().isNotEmpty) ? user.name.trim() : _defaultName;
    final displayEmail = (user != null && user.email.trim().isNotEmpty) ? user.email.trim() : _defaultEmail;
    final displayPhone = (user != null && user.phone.trim().isNotEmpty) ? user.phone.trim() : _defaultPhone;
    final initials = _getInitials(displayName);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Sticky Top Header (← Profile)
            Container(
              color: const Color(0xFFFAFAFC),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              alignment: Alignment.centerLeft,
              child: _buildTopAppBar(context),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                physics: const BouncingScrollPhysics(),
                children: [
                  // 2. PROFILE HERO CARD (Soft Lavender with Brand Avatar, Details & Edit Profile)
                  if (isAuthenticated)
                    _buildProfileHero(
                      context: context,
                      user: user,
                      name: displayName,
                      email: displayEmail,
                      phone: displayPhone,
                      initials: initials,
                    )
                  else
                    _buildGuestProfileHero(context),
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
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const ActiveBookingsScreen(),
                      ),
                    );
                  },
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
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SavedAddressesScreen(),
                      ),
                    );
                  },
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
                _buildDivider(),
                _buildMenuItem(
                  icon: Icons.explore_outlined,
                  tintBg: const Color(0xFFEEF2FF),
                  tintFg: const Color(0xFF4338CA),
                  title: 'App Tour & Onboarding',
                  subtitle: 'Revisit feature highlights and guide',
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const OnboardingScreen(isRevisit: true),
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

            // 7. SIGN OUT / SIGN IN CARD
            if (isAuthenticated) ...[
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
              const SizedBox(height: 12),

              // 8. DELETE ACCOUNT CARD
              _buildCardGroup(
                children: [
                  InkWell(
                    onTap: () => _showDeleteAccountDialog(context, auth),
                    borderRadius: BorderRadius.circular(22),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.delete_outline_rounded,
                                size: 22,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Delete account',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFFDC2626),
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Permanently remove your data',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w400,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ] else ...[
              _buildCardGroup(
                children: [
                  InkWell(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                    },
                    borderRadius: BorderRadius.circular(22),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEF2FF),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.login_rounded,
                                size: 20,
                                color: Color(0xFF4338CA),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Text(
                              'Sign In / Register',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF4338CA),
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            size: 20,
                            color: Color(0xFF4338CA),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
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
  // GUEST PROFILE HERO CARD (Prompt to sign in)
  // --------------------------------------------------------------------------
  Widget _buildGuestProfileHero(BuildContext context) {
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
          // Guest avatar circle
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
            child: const Center(
              child: Icon(
                Icons.person_rounded,
                size: 34,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Welcome Guest',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E1B2E),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Sign in to manage bookings & addresses',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4338CA),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF4338CA).withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Text(
                      'Sign In / Register →',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
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
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => EditProfileScreen(
                          initialName: name,
                          initialEmail: email,
                          initialPhone: phone,
                          initialAvatarUrl: user?.avatarUrl,
                        ),
                      ),
                    );
                    if (context.mounted) {
                      setState(() {});
                    }
                  },
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





















  Future<void> _handleLogout(BuildContext context, AuthProvider auth) async {
    final confirm = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Stack(
          children: [
            // Warm glow at the top behind the icon
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 150,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      const Color(0xFFFFE4E6).withValues(alpha: 0.8), // rose-100
                      const Color(0xFFFFF7ED).withValues(alpha: 0.5), // orange-50
                      Colors.white.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Drag handle
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Glowing Red Logout Icon with concentric rings
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFFFB7185).withValues(alpha: 0.25),
                        ),
                      ),
                      Container(
                        width: 66,
                        height: 66,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFFFB7185).withValues(alpha: 0.35),
                        ),
                      ),
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFFFF8FA3), Color(0xFFDC2626)],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFDC2626).withValues(alpha: 0.45),
                              blurRadius: 18,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.logout_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Title
                  const Text(
                    'Log out of HomeCareX?',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Subtitle
                  const Text(
                    "You'll need to sign in again to book or track a service.",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF64748B),
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Note item 1: Signed out on this device
                  _buildLogoutNoteItem(
                    icon: Icons.phone_android_rounded,
                    text: "You'll be signed out on this device",
                    iconColor: const Color(0xFFE11D48),
                    iconBgColor: const Color(0xFFFFF1F2),
                  ),
                  const SizedBox(height: 8),

                  // Note item 2: Bookings and saved addresses stay safe
                  _buildLogoutNoteItem(
                    icon: Icons.calendar_today_rounded,
                    text: "Your bookings and saved addresses stay safe",
                    iconColor: const Color(0xFF059669),
                    iconBgColor: const Color(0xFFECFDF5),
                  ),
                  const SizedBox(height: 8),

                  // Note item 3: Sign in again anytime
                  _buildLogoutNoteItem(
                    icon: Icons.shield_outlined,
                    text: "Sign in again anytime to book or track a service",
                    iconColor: const Color(0xFF0284C7),
                    iconBgColor: const Color(0xFFF0F9FF),
                  ),
                  const SizedBox(height: 24),

                  // Action Buttons: Stay signed in / Yes, log out
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4338CA),
                            foregroundColor: Colors.white,
                            elevation: 3,
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            shadowColor: const Color(0xFF4338CA).withValues(alpha: 0.4),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
                            ),
                            minimumSize: const Size.fromHeight(48),
                          ),
                          onPressed: () => Navigator.of(sheetContext).pop(false),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.shield_outlined, size: 15, color: Colors.white),
                              SizedBox(width: 5),
                              Flexible(
                                child: Text(
                                  'Stay signed in',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFDC2626),
                            backgroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            side: BorderSide(
                              color: const Color(0xFFEF4444).withValues(alpha: 0.4),
                              width: 1.5,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
                            ),
                            minimumSize: const Size.fromHeight(48),
                          ),
                          onPressed: () => Navigator.of(sheetContext).pop(true),
                          child: const Text(
                            'Yes, log out',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    if (confirm == true) {
      await auth.logout();
      if (context.mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainNavigationScreen(initialIndex: 2)),
          (route) => false,
        );
      }
    }
  }

  Widget _buildLogoutNoteItem({
    required IconData icon,
    required String text,
    required Color iconColor,
    required Color iconBgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Icon(icon, size: 18, color: iconColor),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF1E293B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 18),

              // Trash icon with soft red halo
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFFF87171),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFF87171).withValues(alpha: 0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(
                    Icons.delete_outline_rounded,
                    color: Colors.white,
                    size: 26,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Title
              const Text(
                'Delete your account?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E1B2E),
                ),
              ),
              const SizedBox(height: 8),

              // Subtitle
              const Text(
                'Are you sure? This action is permanent and cannot be undone.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),

              // Warning bullets
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                ),
                child: const Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFE11D48)),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'All your profile data, addresses, and bookings will be permanently removed.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF881337), height: 1.35),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.account_balance_wallet_outlined, size: 18, color: Color(0xFFE11D48)),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Wallet balance and referral benefits will be forfeited.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF881337), height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4F46E5),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      onPressed: () => Navigator.pop(sheetContext),
                      icon: const Icon(Icons.shield_outlined, size: 18),
                      label: const Text(
                        'Keep account',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFFCA5A5), width: 1.5),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      onPressed: () async {
                        Navigator.pop(sheetContext);
                        final scaffoldMessenger = ScaffoldMessenger.of(context);
                        final nav = Navigator.of(context);
                        await auth.deleteAccount();
                        scaffoldMessenger.showSnackBar(
                          const SnackBar(
                            content: Text('Account permanently deleted.'),
                            backgroundColor: Color(0xFFDC2626),
                          ),
                        );
                        nav.pushAndRemoveUntil(
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                          (route) => false,
                        );
                      },
                      icon: const Icon(Icons.delete_outline_rounded, size: 18),
                      label: const Text(
                        'Yes, delete',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
