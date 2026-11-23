import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/screens/main_navigation_screen.dart';
import 'package:homecarex_mobile/screens/reviews/reviews_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
  });

  testWidgets('Test clicking Profile tab and navigating options in MainNavigationScreen', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
          ChangeNotifierProvider(create: (_) => BookingProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const MainNavigationScreen(),
        ),
      ),
    );
    await tester.pump();

    // 1. Tap Profile tab (index 4)
    final profileTabFinder = find.text('Profile');
    expect(profileTabFinder, findsOneWidget);

    await tester.tap(profileTabFinder);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify profile sections exist
    expect(find.text('BOOKINGS'), findsOneWidget);
    expect(find.text('ACCOUNT'), findsOneWidget);

    // Verify Addresses menu item has no '2 saved' badge
    expect(find.text('Addresses'), findsOneWidget);
    expect(find.text('2 saved'), findsNothing);

    // Verify new options: Change password & Notifications
    expect(find.text('Change password'), findsOneWidget);
    expect(find.text('Keep your account secure'), findsOneWidget);
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Choose alerts & your language'), findsOneWidget);

    // 2. Tap Reviews option
    final reviewsFinder = find.text('Reviews');
    expect(reviewsFinder, findsOneWidget);
    await tester.tap(reviewsFinder);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify Reviews Screen opened
    expect(find.byType(ReviewsScreen), findsOneWidget);

    // Go back to Profile
    final backFinder = find.byIcon(Icons.arrow_back_rounded);
    expect(backFinder, findsWidgets);
    await tester.tap(backFinder.last);
    await tester.pumpAndSettle();

    // 3. Tap Referrals option
    final referralsFinder = find.text('Referrals');
    expect(referralsFinder, findsOneWidget);
    await tester.tap(referralsFinder);
    await tester.pumpAndSettle();

    // Verify Referrals screen opened
    expect(find.text('Invite a friend to HomeCareX'), findsOneWidget);

    // Go back to Profile
    await tester.tap(find.byIcon(Icons.arrow_back_rounded).last);
    await tester.pumpAndSettle();

    // 4. Tap Privacy Policy option
    final privacyFinder = find.text('Privacy Policy');
    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(privacyFinder, findsOneWidget);
    await tester.tap(privacyFinder);
    await tester.pumpAndSettle();

    // Verify Privacy Policy opened
    expect(find.text('How we collect, use and protect your data.'), findsOneWidget);

    // Go back to Profile
    await tester.tap(find.byIcon(Icons.arrow_back_rounded).last);
    await tester.pumpAndSettle();

    // 5. Verify Delete account card
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pumpAndSettle();

    expect(find.text('Delete account'), findsOneWidget);
    expect(find.text('Permanently remove your data'), findsOneWidget);

    await tester.tap(find.text('Delete account'));
    await tester.pumpAndSettle();

    expect(find.text('Delete your account?'), findsOneWidget);
    expect(find.text('Keep account'), findsOneWidget);
    expect(find.text('Yes, delete'), findsOneWidget);

    // Tap Keep account to dismiss
    await tester.tap(find.text('Keep account'));
    await tester.pumpAndSettle();
  });
}
