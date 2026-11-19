import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/services/storage_service.dart';
import '../main_navigation_screen.dart';
import '../auth/login_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<OnboardingSlide> _slides = const [
    OnboardingSlide(
      icon: Icons.cleaning_services_rounded,
      iconColor: AppColors.brand,
      badgeText: 'CONVENIENT & ON-DEMAND',
      title: 'Expert Home Services At Your Doorstep',
      subtitle:
          'From AC repair to deep cleaning, plumbing, and painting — book certified professionals in just 60 seconds.',
    ),
    OnboardingSlide(
      icon: Icons.verified_user_rounded,
      iconColor: AppColors.success,
      badgeText: 'SAFETY GUARANTEED',
      title: 'Verified & Background-Checked Pros',
      subtitle:
          'Every service partner undergoes 5-point background verification, police checks, and skill training.',
    ),
    OnboardingSlide(
      icon: Icons.track_changes_rounded,
      iconColor: AppColors.accent,
      badgeText: 'TRANSPARENT & SECURE',
      title: 'Live Tracking & Service OTP Start',
      subtitle:
          'Track your pro in real-time. Share a secure 4-digit PIN upon arrival and pay seamlessly with UPI or cash.',
    ),
  ];

  Future<void> _completeOnboarding({bool toLogin = false}) async {
    await StorageService.setOnboardingCompleted(true);
    if (!mounted) return;

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          TextButton(
            onPressed: () => _completeOnboarding(),
            child: const Text(
              'Skip',
              style: TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _slides.length,
                onPageChanged: (idx) => setState(() => _currentPage = idx),
                itemBuilder: (context, index) {
                  final slide = _slides[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Slide Icon Container
                        Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            color: slide.iconColor.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: slide.iconColor.withValues(alpha: 0.2),
                              width: 2,
                            ),
                          ),
                          child: Center(
                            child: Icon(
                              slide.icon,
                              size: 72,
                              color: slide.iconColor,
                            ),
                          ),
                        ),

                        const SizedBox(height: 36),

                        // Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: slide.iconColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            slide.badgeText,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: slide.iconColor,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Title
                        Text(
                          slide.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: AppColors.text,
                            height: 1.3,
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Subtitle
                        Text(
                          slide.subtitle,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppColors.muted,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Bottom Navigation & Indicators
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  // Page Indicators
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _slides.length,
                      (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: _currentPage == i ? 28 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _currentPage == i ? AppColors.brand : AppColors.line,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),

                  // Action Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: () {
                        if (_currentPage < _slides.length - 1) {
                          _pageController.nextPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        } else {
                          _completeOnboarding();
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.brand,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        _currentPage == _slides.length - 1 ? 'Get Started' : 'Next',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Already have account
                  if (_currentPage == _slides.length - 1)
                    TextButton(
                      onPressed: () => _completeOnboarding(toLogin: true),
                      child: const Text(
                        'Already have an account? Sign In',
                        style: TextStyle(
                          color: AppColors.brand,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    )
                  else
                    const SizedBox(height: 48),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingSlide {
  final IconData icon;
  final Color iconColor;
  final String badgeText;
  final String title;
  final String subtitle;

  const OnboardingSlide({
    required this.icon,
    required this.iconColor,
    required this.badgeText,
    required this.title,
    required this.subtitle,
  });
}

