import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/providers/address_provider.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/providers/notification_provider.dart';
import 'package:homecarex_mobile/screens/auth/login_screen.dart';
import 'package:homecarex_mobile/screens/main_navigation_screen.dart';
import 'package:homecarex_mobile/screens/onboarding/onboarding_screen.dart';
import 'package:homecarex_mobile/screens/splash/splash_screen.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
    await StorageService.resetOnboarding();
  });

  Widget createWidget({Widget? child, bool isRevisit = false}) {
    final authProv = AuthProvider();
    final catProv = CatalogProvider();
    final cartProv = CartProvider();
    final bookingProv = BookingProvider()..syncRemote = false;
    final notifProv = NotificationProvider()..syncRemote = false;
    final addrProv = AddressProvider()..syncRemote = false;

    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authProv),
        ChangeNotifierProvider.value(value: catProv),
        ChangeNotifierProvider.value(value: cartProv),
        ChangeNotifierProvider.value(value: bookingProv),
        ChangeNotifierProvider.value(value: notifProv),
        ChangeNotifierProvider.value(value: addrProv),
      ],
      child: MaterialApp(
        theme: ThemeData(
          splashFactory: NoSplash.splashFactory,
        ),
        home: child ?? OnboardingScreen(isRevisit: isRevisit),
      ),
    );
  }

  testWidgets('OnboardingScreen renders slide 1 with title, badge, and features',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    // Slide 1 elements
    expect(find.text('CONVENIENT & ON-DEMAND'), findsOneWidget);
    expect(find.text('Expert Home Services\nAt Your Doorstep'), findsOneWidget);
    expect(find.textContaining('From AC repair and plumbing'), findsOneWidget);
    expect(find.text('⚡ 60s Booking'), findsOneWidget);
    expect(find.text('📍 Live Tracking'), findsOneWidget);
    expect(find.text('🛡️ Certified Pros'), findsOneWidget);
    expect(find.text('Skip'), findsOneWidget);
    expect(find.text('Next'), findsOneWidget);
  });

  testWidgets('OnboardingScreen advances through all 3 slides using Next button',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    // Slide 1 -> Slide 2
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    expect(find.text('SAFETY GUARANTEED'), findsOneWidget);
    expect(find.text('Verified & Background\nChecked Pros'), findsOneWidget);
    expect(find.text('✓ 5-Point KYC'), findsOneWidget);
    expect(find.text('✓ Police Cleared'), findsOneWidget);

    // Slide 2 -> Slide 3
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    expect(find.text('TRANSPARENT & SECURE'), findsOneWidget);
    expect(find.text('Live Tracking &\nSecure Start OTP'), findsOneWidget);
    expect(find.text('🔒 4-Digit OTP'), findsOneWidget);
    expect(find.text('💳 Razorpay & UPI'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);
    expect(find.text('Already have an account? Sign In'), findsOneWidget);
  });

  testWidgets('Tapping Get Started completes onboarding and navigates to MainNavigationScreen',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    // Advance to last slide
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    // Tap Get Started
    await tester.tap(find.text('Get Started'));
    await tester.pumpAndSettle();

    final isCompleted = await StorageService.isOnboardingCompleted();
    expect(isCompleted, isTrue);
    expect(find.byType(MainNavigationScreen), findsOneWidget);
  });

  testWidgets('Tapping Skip completes onboarding and navigates to MainNavigationScreen',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    final isCompleted = await StorageService.isOnboardingCompleted();
    expect(isCompleted, isTrue);
    expect(find.byType(MainNavigationScreen), findsOneWidget);
  });

  testWidgets('Tapping Already have an account? Sign In navigates to LoginScreen',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    // Advance to slide 3
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Already have an account? Sign In'));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('SplashScreen navigates to OnboardingScreen when onboarding is pending',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.resetOnboarding();

    await tester.pumpWidget(
      createWidget(child: const SplashScreen()),
    );

    // Initial splash frame
    expect(find.byType(SplashScreen), findsOneWidget);

    // Pump past splash duration (1200ms)
    await tester.pump(const Duration(milliseconds: 1400));
    await tester.pumpAndSettle();

    // Must navigate to OnboardingScreen
    expect(find.byType(OnboardingScreen), findsOneWidget);
  });
}
