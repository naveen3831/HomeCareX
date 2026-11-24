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
import 'package:homecarex_mobile/screens/home/home_screen.dart';
import 'package:homecarex_mobile/screens/profile/profile_screen.dart';
import 'package:homecarex_mobile/screens/main_navigation_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
  });

  Widget createGuestHomeTestWidget({AuthProvider? authProvider}) {
    final auth = authProvider ?? AuthProvider();
    final bookingProvider = BookingProvider()..syncRemote = false;

    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider.value(value: bookingProvider),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => AddressProvider()),
      ],
      child: MaterialApp(
        theme: ThemeData(splashFactory: NoSplash.splashFactory),
        home: const HomeScreen(),
      ),
    );
  }

  testWidgets('HomeScreen renders guest header, greeting, hero carousel, and promo card when logged out', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.setLoggedOut(true);
    await StorageService.setLoggedOut(true);
    final authProvider = AuthProvider();
    authProvider.setUser(null); // Explicitly logged out guest

    await tester.pumpWidget(createGuestHomeTestWidget(authProvider: authProvider));
    await tester.pump(const Duration(milliseconds: 200));

    // 1. Top Header: Brand logo, location pill, notification bell
    expect(find.byType(Image), findsWidgets);
    expect(find.text('Hyderabad'), findsOneWidget);

    // 2. Greeting section matching image
    expect(find.text('Welcome to HomeCareX', findRichText: true), findsOneWidget);
    expect(find.text('Book trusted professionals for your home needs.'), findsOneWidget);

    // 3. Guest Hero Carousel matching reference
    expect(find.text('Home services'), findsOneWidget);
    expect(find.text('Professional Home Services'), findsOneWidget);
    expect(find.text('Explore services'), findsOneWidget);

    // 4. Guest Promo card matching reference
    expect(find.text('30-Day Warranty'), findsOneWidget);
    expect(find.text('Appliance Repair\nServices'), findsOneWidget);

    // 5. Authenticated elements are NOT present
    expect(find.text('Welcome, TATUKULA'), findsNothing);
    expect(find.text('Deliver to '), findsNothing);
  });

  testWidgets('Guest location pill toggles city picker dropdown and selects city', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.setLoggedOut(true);
    final authProvider = AuthProvider();
    authProvider.setUser(null);

    await tester.pumpWidget(createGuestHomeTestWidget(authProvider: authProvider));
    await tester.pump(const Duration(milliseconds: 200));

    // City dropdown initially not open
    expect(find.text('Select Service City'), findsNothing);

    // Tap location pill: 📍 Hyderabad ˇ
    await tester.tap(find.text('Hyderabad'));
    await tester.pump(const Duration(milliseconds: 100));

    // City dropdown opened
    expect(find.text('Select Service City'), findsOneWidget);
    expect(find.text('Bengaluru'), findsOneWidget);
    expect(find.text('Mumbai'), findsOneWidget);

    // Select Bengaluru
    await tester.tap(find.text('Bengaluru'));
    await tester.pump(const Duration(milliseconds: 100));

    // Dropdown closes and header updates
    expect(find.text('Select Service City'), findsNothing);
    expect(find.text('Bengaluru'), findsOneWidget);
  });

  testWidgets('Logging out from ProfileScreen navigates to MainNavigationScreen and displays guest view', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    SharedPreferences.setMockInitialValues({
      'auth_token': 'mock_token',
      'auth_user': '{"id":"customer_default","name":"TATUKULA EDUKONDALU","email":"tatukulaedukondalu@gmail.com","phone":"8346167714","role":"customer"}',
    });
    StorageService.clearCache();

    final authProvider = AuthProvider()..setUser(AuthProvider.defaultCustomer);
    final bookingProvider = BookingProvider()..syncRemote = false;

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: authProvider),
          ChangeNotifierProvider(create: (_) => CartProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider.value(value: bookingProvider),
          ChangeNotifierProvider(create: (_) => NotificationProvider()),
          ChangeNotifierProvider(create: (_) => AddressProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(splashFactory: NoSplash.splashFactory),
          home: const ProfileScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    // Verify authenticated profile is shown
    expect(find.text('TATUKULA EDUKONDALU'), findsOneWidget);

    // Scroll down to Log out button
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();

    final logoutFinder = find.text('Log out');
    expect(logoutFinder, findsOneWidget);

    // Tap Log out
    await tester.tap(logoutFinder);
    await tester.pumpAndSettle();

    // Confirm bottom sheet dialog matches web styling
    expect(find.text('Log out of HomeCareX?'), findsOneWidget);
    expect(find.text("You'll be signed out on this device"), findsOneWidget);
    expect(find.text('Your bookings and saved addresses stay safe'), findsOneWidget);
    expect(find.text('Sign in again anytime to book or track a service'), findsOneWidget);
    expect(find.text('Stay signed in'), findsOneWidget);
    expect(find.text('Yes, log out'), findsOneWidget);
    await tester.tap(find.text('Yes, log out'));
    await tester.pumpAndSettle();

    // Verify navigated to MainNavigationScreen in guest mode
    expect(find.byType(MainNavigationScreen), findsOneWidget);
    expect(find.text('Welcome to HomeCareX', findRichText: true), findsOneWidget);
    expect(find.text('Book trusted professionals for your home needs.'), findsOneWidget);
    expect(find.text('Professional Home Services'), findsOneWidget);
  });
}
