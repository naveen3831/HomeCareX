import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/providers/notification_provider.dart';
import 'package:homecarex_mobile/providers/address_provider.dart';
import 'package:homecarex_mobile/screens/main_navigation_screen.dart';
import 'package:homecarex_mobile/screens/auth/login_screen.dart';
import 'package:homecarex_mobile/screens/auth/forgot_password_screen.dart';
import 'package:homecarex_mobile/screens/profile/profile_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
  });

  Widget createTestWidget({AuthProvider? authProvider}) {
    final auth = authProvider ?? AuthProvider();
    final bookingProv = BookingProvider()..syncRemote = false;
    final notifProv = NotificationProvider()..syncRemote = false;
    final addrProv = AddressProvider()..syncRemote = false;

    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider.value(value: bookingProv),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider.value(value: notifProv),
        ChangeNotifierProvider.value(value: addrProv),
      ],
      child: MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: NoSplash.splashFactory,
        ),
        home: const MainNavigationScreen(initialIndex: 2),
      ),
    );
  }

  testWidgets('In guest mode, tapping Profile tab opens LoginScreen with all matching elements', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.setLoggedOut(true);
    final auth = AuthProvider();
    auth.setUser(null); // Guest mode

    await tester.pumpWidget(createTestWidget(authProvider: auth));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Confirm starting on Home tab
    expect(find.text('HOMECAREX', findRichText: true), findsWidgets);

    // Tap Profile tab (index 4)
    final profileTabFinder = find.text('Profile');
    expect(profileTabFinder, findsOneWidget);
    await tester.tap(profileTabFinder);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify LoginScreen is shown inside Profile tab in guest mode
    expect(find.byType(LoginScreen), findsOneWidget);

    // 1. Top Bar: Back to Home & Secure Login
    expect(find.text('Back to Home'), findsOneWidget);
    expect(find.text('Secure Login'), findsOneWidget);

    // 2. Brand header & titles
    expect(find.text('Welcome Back 👋'), findsOneWidget);
    expect(find.text('Sign in to manage your home care and book services'), findsOneWidget);

    // 3. Form input labels & fields
    expect(find.text('Email or Phone Number *', findRichText: true), findsOneWidget);
    expect(find.text('Enter your email or phone number'), findsOneWidget);
    expect(find.text('Password *', findRichText: true), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);

    // 4. Options: Remember me & Forgot Password
    expect(find.text('Remember me'), findsOneWidget);
    expect(find.text('Forgot Password?'), findsOneWidget);

    // 5. Terms consent
    expect(find.text('Terms & Conditions'), findsOneWidget);
    expect(find.text('Privacy Policy'), findsOneWidget);

    // 6. Sign In CTA
    expect(find.text('Sign In'), findsOneWidget);

    // 7. Footer: Don't have an account? Create an Account
    expect(find.text('Create an Account'), findsOneWidget);
  });

  testWidgets('Tapping Back to Home from LoginScreen returns to Home tab', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.setLoggedOut(true);
    final auth = AuthProvider();
    auth.setUser(null); // Guest mode

    await tester.pumpWidget(createTestWidget(authProvider: auth));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Tap Profile tab
    await tester.tap(find.text('Profile'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(LoginScreen), findsOneWidget);

    // Tap < Back to Home
    final backToHomeFinder = find.text('Back to Home');
    expect(backToHomeFinder, findsOneWidget);
    await tester.tap(backToHomeFinder);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify returned to Home tab
    expect(find.text('Welcome to HomeCareX', findRichText: true), findsOneWidget);
  });

  testWidgets('Tapping Forgot Password? opens ForgotPasswordScreen', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.setLoggedOut(true);
    final auth = AuthProvider();
    auth.setUser(null); // Guest mode

    await tester.pumpWidget(createTestWidget(authProvider: auth));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Tap Profile tab
    await tester.tap(find.text('Profile'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Tap Forgot Password?
    final forgotPasswordFinder = find.text('Forgot Password?');
    expect(forgotPasswordFinder, findsOneWidget);
    await tester.tap(forgotPasswordFinder);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(ForgotPasswordScreen), findsOneWidget);
  });

  testWidgets('Logging in from LoginScreen dynamically transitions to ProfileScreen', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.setLoggedOut(true);
    final auth = AuthProvider();
    auth.setUser(null); // Guest mode

    await tester.pumpWidget(createTestWidget(authProvider: auth));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Tap Profile tab
    await tester.tap(find.text('Profile'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(LoginScreen), findsOneWidget);

    // Authenticate user
    auth.setUser(AuthProvider.defaultCustomer);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify ProfileScreen is now shown
    expect(find.byType(ProfileScreen), findsOneWidget);
    expect(find.text('BOOKINGS'), findsOneWidget);
    expect(find.text('ACCOUNT'), findsOneWidget);
  });
}
