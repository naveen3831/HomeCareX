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

  testWidgets('HomeScreen renders guest header, greeting, category hero, browse categories, services for you, and offers when logged out (no upcoming)', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await StorageService.setLoggedOut(true);
    final authProvider = AuthProvider();
    authProvider.setUser(null); // Explicitly logged out guest

    await tester.pumpWidget(createGuestHomeTestWidget(authProvider: authProvider));
    await tester.pump(const Duration(milliseconds: 200));

    // 1. Top Header: Brand logo, location pill, notification bell
    expect(find.byType(Image), findsWidgets);
    expect(find.text('Hyderabad'), findsOneWidget);

    // 2. Greeting section matching reference (guest mode: Welcome to HomeCareX)
    expect(find.textContaining('Good ', findRichText: true), findsOneWidget);
    expect(find.text('Welcome to HomeCareX', findRichText: true), findsOneWidget);
    expect(find.text('Trusted professionals at your door. Transparent prices, no surprises.'), findsOneWidget);

    // 3. Category Hero Banner Carousel (Appliance Repair & Service photo + dots + title)
    expect(find.text('Appliance Repair & Service'), findsWidgets);

    // 4. Search Bar (Search input + Mic + Orange search button)
    expect(find.byIcon(Icons.mic_rounded), findsOneWidget);
    expect(find.byIcon(Icons.search_rounded), findsWidgets);

    // 5. Authenticated elements and upcoming booking section are STRICTLY NOT present in guest mode
    expect(find.text('Upcoming'), findsNothing);
    expect(find.text('Welcome, TATUKULA'), findsNothing);
    expect(find.text('Deliver to '), findsNothing);

    // 6. Browse Categories 2x2 photographic grid
    expect(find.text('Browse categories'), findsOneWidget);
    expect(find.text('View all'), findsWidgets);
    expect(find.text('Salon & Spa'), findsWidgets);
    expect(find.text('Home Cleaning'), findsWidgets);
    expect(find.text('Electrical & Plumbing'), findsWidgets);

    // 7. Services for you section
    expect(find.text('Services for you'), findsOneWidget);

    // 8. Offers for you section
    expect(find.text('Offers for you'), findsOneWidget);
    expect(find.text('Flat 20% OFF'), findsOneWidget);
    expect(find.text('On Your First Booking'), findsOneWidget);
    expect(find.text('Use Code: HOME20'), findsOneWidget);
    expect(find.text('Refer a friend, earn ₹50'), findsOneWidget);
  });

  testWidgets('Guest category card in Browse categories navigates to ServicesScreen', (tester) async {
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

    // Browse categories is visible
    expect(find.text('Browse categories'), findsOneWidget);

    // Tap on Salon & Spa category card
    final salonSpaFinder = find.text('Salon & Spa').first;
    expect(salonSpaFinder, findsOneWidget);
    await tester.tap(salonSpaFinder);
    await tester.pumpAndSettle();

    // Verify navigated to ServicesScreen
    expect(find.byType(HomeScreen), findsNothing);
  });

  testWidgets('Guest Home Screen allows copying coupon code HOME20 and shows SnackBar', (tester) async {
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

    // Scroll down to Offers section
    await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -600));
    await tester.pumpAndSettle();

    final couponFinder = find.text('Use Code: HOME20');
    expect(couponFinder, findsOneWidget);

    await tester.tap(couponFinder);
    await tester.pump();

    expect(find.text('Coupon code "HOME20" copied to clipboard!'), findsOneWidget);
    expect(find.text('Copied! ✓'), findsOneWidget);

    // Advance past the 2-second timer so no pending timers remain
    await tester.pump(const Duration(seconds: 3));
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
    expect(find.text('Bengaluru'), findsWidgets);
    expect(find.text('Mumbai'), findsWidgets);

    // Select Bengaluru from the dropdown menu
    await tester.tap(find.text('Bengaluru').last);
    await tester.pump(const Duration(milliseconds: 100));

    // Dropdown closes and header updates
    expect(find.text('Select Service City'), findsNothing);
    expect(find.text('Bengaluru'), findsWidgets);
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
    expect(find.text('Trusted professionals at your door. Transparent prices, no surprises.'), findsOneWidget);
    expect(find.text('Appliance Repair & Service'), findsWidgets);
    expect(find.text('Browse categories'), findsOneWidget);
    expect(find.text('Upcoming'), findsNothing);
  });
}
