import 'package:flutter/material.dart';
import '../../core/services/storage_service.dart';
import '../auth/login_screen.dart';
import '../main_navigation_screen.dart';

/// Premium Onboarding Screen matching the luxury editorial design format.
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
      imagePath: 'assets/images/home-cleaning.jpg',
      imageFit: BoxFit.cover,
      imageAlignment: Alignment.center,
      floatingIcon: Icons.cleaning_services_rounded,
      badgeText: 'CONVENIENT & ON-DEMAND',
      title: 'EXPERT HOME SERVICES\nAT YOUR DOORSTEP',
      subtitle:
          'From AC repair and plumbing to deep cleaning, carpentry, and salon — book certified professionals in just 60 seconds.',
      features: ['60s Fast Booking', 'Live Tracking', 'Certified Pros'],
    ),
    OnboardingSlideData(
      imagePath: 'assets/images/quality-service.jpg',
      imageFit: BoxFit.cover,
      imageAlignment: Alignment.topCenter,
      floatingIcon: Icons.shield_rounded,
      badgeText: 'SAFETY GUARANTEED',
      title: 'VERIFIED & BACKGROUND\nCHECKED PROS',
      subtitle:
          'Every service partner undergoes 5-point KYC verification, criminal background check, and rigorous skill training.',
      features: ['5-Point KYC', 'Police Cleared', 'Skill Tested'],
    ),
    OnboardingSlideData(
      imagePath: 'assets/images/appliance-repair.jpg',
      imageFit: BoxFit.cover,
      imageAlignment: Alignment.center,
      floatingIcon: Icons.lock_rounded,
      badgeText: 'TRANSPARENT & SECURE',
      title: 'LIVE TRACKING &\nSECURE START OTP',
      subtitle:
          'Track your partner in real time on the map. Share a secure 4-digit PIN upon arrival and pay seamlessly with Razorpay, UPI, or cash.',
      features: ['4-Digit Start OTP', 'Razorpay & UPI', 'Cash on Service'],
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
      backgroundColor: const Color(0xFFFAFAF9),
      body: SafeArea(
        child: Column(
          children: [
            // Top Navigation Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (widget.isRevisit)
                    IconButton(
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
                      onPressed: () => Navigator.of(context).pop(),
                    )
                  else
                    // HomeCareX Brand Logo
                    Image.asset(
                      'assets/images/logo.png',
                      height: 28,
                      fit: BoxFit.contain,
                      semanticLabel: 'HomeCareX Logo',
                      errorBuilder: (_, __, ___) => const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.home_repair_service_rounded,
                            size: 20,
                            color: Color(0xFF8B6414),
                          ),
                          SizedBox(width: 6),
                          Text(
                            'HomeCareX',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF8B6414),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Skip Button
                  GestureDetector(
                    onTap: () => _completeOnboarding(),
                    behavior: HitTestBehavior.opaque,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      child: Text(
                        'Skip',
                        style: TextStyle(
                          color: Color(0xFF334155),
                          fontWeight: FontWeight.w700,
                          fontSize: 14.5,
                        ),
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
                  return LayoutBuilder(
                    builder: (context, constraints) {
                      return SingleChildScrollView(
                        physics: const BouncingScrollPhysics(),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: constraints.maxHeight,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const SizedBox(height: 12),

                                // Centered Outline Capsule Badge
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6.5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFFBEB),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: const Color(0xFFE2D6C0), width: 1.0),
                                  ),
                                  child: Text(
                                    slide.badgeText,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF8B6414),
                                      letterSpacing: 1.8,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 16),

                                // Hero Image Card with Rounded Corners & Floating Button
                                Container(
                                  height: 255,
                                  width: double.infinity,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(24),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.08),
                                        blurRadius: 18,
                                        offset: const Offset(0, 6),
                                      ),
                                    ],
                                  ),
                                  child: Stack(
                                    children: [
                                      Positioned.fill(
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(24),
                                          child: Image.asset(
                                            slide.imagePath,
                                            fit: slide.imageFit,
                                            alignment: slide.imageAlignment,
                                            errorBuilder: (_, __, ___) => Container(
                                              color: const Color(0xFFF1F5F9),
                                              child: Center(
                                                child: Icon(
                                                  slide.floatingIcon,
                                                  size: 64,
                                                  color: const Color(0xFF8B6414),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                      // Floating Round Action Button in Bottom-Right
                                      Positioned(
                                        bottom: 14,
                                        right: 14,
                                        child: Container(
                                          width: 44,
                                          height: 44,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF8B6414),
                                            shape: BoxShape.circle,
                                            boxShadow: [
                                              BoxShadow(
                                                color: const Color(0xFF8B6414).withValues(alpha: 0.35),
                                                blurRadius: 10,
                                                offset: const Offset(0, 4),
                                              ),
                                            ],
                                          ),
                                          child: Icon(
                                            slide.floatingIcon,
                                            color: Colors.white,
                                            size: 22,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 22),

                                // Headline Title (Centered, all caps, bold)
                                Text(
                                  slide.title,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 21,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: 0.8,
                                    height: 1.25,
                                  ),
                                ),
                                const SizedBox(height: 10),

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
                                const SizedBox(height: 18),

                                // Feature Capsules
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  alignment: WrapAlignment.center,
                                  children: slide.features.map((feat) {
                                    return Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(color: const Color(0xFFE2E8F0)),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withValues(alpha: 0.03),
                                            blurRadius: 4,
                                            offset: const Offset(0, 1),
                                          ),
                                        ],
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            Icons.check_circle_rounded,
                                            size: 14,
                                            color: Color(0xFF8B6414),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            feat,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF1E293B),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }).toList(),
                                ),
                                const SizedBox(height: 12),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),

            // Bottom Navigation Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Page Indicators
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: List.generate(
                          _slides.length,
                          (i) {
                            final isActive = _currentPage == i;
                            return AnimatedContainer(
                              duration: const Duration(milliseconds: 250),
                              margin: const EdgeInsets.only(right: 6),
                              width: isActive ? 24 : 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: isActive
                                    ? const Color(0xFF8B6414)
                                    : const Color(0xFFCBD5E1),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            );
                          },
                        ),
                      ),

                      // Next / Get Started Button
                      ElevatedButton(
                        onPressed: _nextPage,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF8B6414),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        child: Text(
                          _currentPage == _slides.length - 1
                              ? (widget.isRevisit ? 'EXPLORE →' : 'GET STARTED →')
                              : 'NEXT →',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                    ],
                  ),

                  // Secondary Sign-In Button on last page
                  if (_currentPage == _slides.length - 1 && !widget.isRevisit)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: GestureDetector(
                        onTap: () => _completeOnboarding(toLogin: true),
                        behavior: HitTestBehavior.opaque,
                        child: const Padding(
                          padding: EdgeInsets.symmetric(vertical: 4),
                          child: Text(
                            'Already have an account? Sign In',
                            style: TextStyle(
                              color: Color(0xFF8B6414),
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingSlideData {
  final String imagePath;
  final BoxFit imageFit;
  final Alignment imageAlignment;
  final IconData floatingIcon;
  final String badgeText;
  final String title;
  final String subtitle;
  final List<String> features;

  const OnboardingSlideData({
    required this.imagePath,
    this.imageFit = BoxFit.cover,
    this.imageAlignment = Alignment.center,
    required this.floatingIcon,
    required this.badgeText,
    required this.title,
    required this.subtitle,
    required this.features,
  });
}
