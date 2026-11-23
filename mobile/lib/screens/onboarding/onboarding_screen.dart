import 'package:flutter/material.dart';
import '../../core/services/storage_service.dart';
import '../auth/login_screen.dart';
import '../main_navigation_screen.dart';

/// Premium Onboarding Screen matching the HomeCareX mobile design language.
class OnboardingScreen extends StatefulWidget {
  final bool isRevisit;

  const OnboardingScreen({
    super.key,
    this.isRevisit = false,
  });

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<OnboardingSlideData> _slides = const [
    OnboardingSlideData(
      icon: Icons.cleaning_services_rounded,
      primaryColor: Color(0xFF4338CA),
      softBgColor: Color(0xFFEEF2FF),
      borderTint: Color(0xFFC7D2FE),
      badgeText: 'CONVENIENT & ON-DEMAND',
      badgeIcon: Icons.bolt_rounded,
      title: 'Expert Home Services\nAt Your Doorstep',
      subtitle:
          'From AC repair and plumbing to deep cleaning, carpentry, and salon — book certified professionals in just 60 seconds.',
      features: ['⚡ 60s Booking', '📍 Live Tracking', '🛡️ Certified Pros'],
      topBadgeIcon: Icons.flash_on_rounded,
      topBadgeText: '60s Fast',
      bottomBadgeIcon: Icons.star_rounded,
      bottomBadgeText: '4.8+ Rated',
    ),
    OnboardingSlideData(
      icon: Icons.verified_user_rounded,
      primaryColor: Color(0xFF059669),
      softBgColor: Color(0xFFECFDF5),
      borderTint: Color(0xFFA7F3D0),
      badgeText: 'SAFETY GUARANTEED',
      badgeIcon: Icons.shield_rounded,
      title: 'Verified & Background\nChecked Pros',
      subtitle:
          'Every service partner undergoes 5-point KYC verification, criminal background check, and rigorous skill training.',
      features: ['✓ 5-Point KYC', '✓ Police Cleared', '✓ Skill Tested'],
      topBadgeIcon: Icons.badge_rounded,
      topBadgeText: 'Verified ID',
      bottomBadgeIcon: Icons.check_circle_rounded,
      bottomBadgeText: '100% Safe',
    ),
    OnboardingSlideData(
      icon: Icons.track_changes_rounded,
      primaryColor: Color(0xFFD97706),
      softBgColor: Color(0xFFFEF3C7),
      borderTint: Color(0xFFFDE68A),
      badgeText: 'TRANSPARENT & SECURE',
      badgeIcon: Icons.lock_rounded,
      title: 'Live Tracking &\nSecure Start OTP',
      subtitle:
          'Track your partner in real time on the map. Share a secure 4-digit PIN upon arrival and pay seamlessly with Razorpay, UPI, or cash.',
      features: ['🔒 4-Digit OTP', '💳 Razorpay & UPI', '💵 Cash on Service'],
      topBadgeIcon: Icons.payments_rounded,
      topBadgeText: 'Razorpay UPI',
      bottomBadgeIcon: Icons.pin_rounded,
      bottomBadgeText: 'Start OTP',
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _completeOnboarding({bool toLogin = false}) async {
    await StorageService.setOnboardingCompleted(true);
    if (!mounted) return;

    if (widget.isRevisit) {
      Navigator.of(context).pop();
      return;
    }

    if (toLogin) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
      );
    }
  }

  void _nextPage() {
    if (_currentPage < _slides.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _completeOnboarding();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Top Navigation Bar (Back if revisit, Skip button on right)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (widget.isRevisit)
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
                      onPressed: () => Navigator.of(context).pop(),
                    )
                  else
                    // HomeCareX Logo
                    Image.asset(
                      'assets/images/logo.png',
                      height: 24,
                      fit: BoxFit.contain,
                      semanticLabel: 'HomeCareX Logo',
                      errorBuilder: (_, __, ___) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.home_repair_service_rounded, size: 14, color: Color(0xFF4338CA)),
                            SizedBox(width: 5),
                            Text(
                              'HomeCareX',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF4338CA),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Skip Button
                  GestureDetector(
                    onTap: () => _completeOnboarding(),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Skip',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFF94A3B8)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Carousel Slides
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _slides.length,
                onPageChanged: (idx) => setState(() => _currentPage = idx),
                itemBuilder: (context, index) {
                  final slide = _slides[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Hero 3D Illustrated Card Container
                        _buildHeroIllustration(slide),
                        const SizedBox(height: 32),

                        // Badge Pill
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: slide.softBgColor,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: slide.borderTint, width: 1.2),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(slide.badgeIcon, size: 13, color: slide.primaryColor),
                              const SizedBox(width: 5),
                              Text(
                                slide.badgeText,
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.bold,
                                  color: slide.primaryColor,
                                  letterSpacing: 0.7,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Headline Title
                        Text(
                          slide.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                            height: 1.25,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Subtitle
                        Text(
                          slide.subtitle,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13.5,
                            color: Color(0xFF64748B),
                            height: 1.45,
                          ),
                        ),
                        const SizedBox(height: 22),

                        // Feature Highlights Capsule Row
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: slide.features.map((feat) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.02),
                                    blurRadius: 4,
                                    offset: const Offset(0, 1),
                                  ),
                                ],
                              ),
                              child: Text(
                                feat,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF334155),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Bottom Controls (Animated Indicators + Action Buttons)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
              child: Column(
                children: [
                  // Smooth Expanding Pill Page Indicators
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _slides.length,
                      (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeOutCubic,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: _currentPage == i ? 32 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _currentPage == i
                              ? const Color(0xFF4338CA)
                              : const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Primary CTA Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _nextPage,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4338CA),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _currentPage == _slides.length - 1
                                ? (widget.isRevisit ? 'Explore Services' : 'Get Started')
                                : 'Next',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Icon(Icons.arrow_forward_rounded, size: 18),
                        ],
                      ),
                    ),
                  ),

                  // Secondary Sign-In Button on last page
                  if (_currentPage == _slides.length - 1 && !widget.isRevisit)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: TextButton(
                        onPressed: () => _completeOnboarding(toLogin: true),
                        child: const Text(
                          'Already have an account? Sign In',
                          style: TextStyle(
                            color: Color(0xFF4338CA),
                            fontWeight: FontWeight.w600,
                            fontSize: 13.5,
                          ),
                        ),
                      ),
                    )
                  else
                    const SizedBox(height: 44),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 3D Layered Hero Illustration for each slide
  Widget _buildHeroIllustration(OnboardingSlideData slide) {
    return SizedBox(
      width: 170,
      height: 170,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          // Outer ambient glow ring
          Container(
            width: 160,
            height: 160,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: slide.primaryColor.withValues(alpha: 0.06),
            ),
          ),
          Container(
            width: 136,
            height: 136,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: slide.primaryColor.withValues(alpha: 0.08),
            ),
          ),

          // Central Clay Card
          Container(
            width: 112,
            height: 112,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white,
                  slide.softBgColor,
                ],
              ),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: slide.borderTint, width: 2),
              boxShadow: [
                BoxShadow(
                  color: slide.primaryColor.withValues(alpha: 0.16),
                  blurRadius: 22,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Center(
              child: Icon(
                slide.icon,
                size: 56,
                color: slide.primaryColor,
              ),
            ),
          ),

          // Floating Top-Right Mini Badge
          Positioned(
            top: 2,
            right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(slide.topBadgeIcon, size: 12, color: slide.primaryColor),
                  const SizedBox(width: 4),
                  Text(
                    slide.topBadgeText,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: slide.primaryColor,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Floating Bottom-Left Mini Badge
          Positioned(
            bottom: 4,
            left: 2,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(slide.bottomBadgeIcon, size: 12, color: const Color(0xFFF59E0B)),
                  const SizedBox(width: 4),
                  Text(
                    slide.bottomBadgeText,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OnboardingSlideData {
  final IconData icon;
  final Color primaryColor;
  final Color softBgColor;
  final Color borderTint;
  final String badgeText;
  final IconData badgeIcon;
  final String title;
  final String subtitle;
  final List<String> features;
  final IconData topBadgeIcon;
  final String topBadgeText;
  final IconData bottomBadgeIcon;
  final String bottomBadgeText;

  const OnboardingSlideData({
    required this.icon,
    required this.primaryColor,
    required this.softBgColor,
    required this.borderTint,
    required this.badgeText,
    required this.badgeIcon,
    required this.title,
    required this.subtitle,
    required this.features,
    required this.topBadgeIcon,
    required this.topBadgeText,
    required this.bottomBadgeIcon,
    required this.bottomBadgeText,
  });
}
