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

    // 3. Top Guest Banner Slider matching web reference
    expect(find.text('Home services'), findsOneWidget);
    expect(find.text('Quality Services at Your\nDoorstep'), findsOneWidget);
    expect(find.text('Explore services'), findsOneWidget);

    // 4. Hero Carousel matching reference
    expect(find.text('Verified Professionals'), findsOneWidget);
    expect(find.text('Home Cleaning\nServices'), findsOneWidget);
    expect(find.text('Deep cleaning for a healthier and happier home.'), findsOneWidget);
    expect(find.text('Book Now'), findsWidgets);

    // 5. Authenticated elements and quick actions are NOT present in guest mode
    expect(find.text('Welcome, TATUKULA'), findsNothing);
    expect(find.text('Deliver to '), findsNothing);
    expect(find.text('Book again'), findsNothing);
    expect(find.text('Track order'), findsNothing);

    // 6. Service Categories 4x2 grid matching web mockup
    expect(find.text('Service Categories'), findsOneWidget);
    expect(find.text('Home Cleaning'), findsWidgets);
    expect(find.text('Appliance Repair'), findsOneWidget);
    expect(find.text('Salon & Spa'), findsOneWidget);
    expect(find.text('Electrical & Plumbing'), findsOneWidget);
    expect(find.text('Painting & Waterproofing'), findsOneWidget);
    expect(find.text('Pest Control'), findsOneWidget);
    expect(find.text('Carpentry & Assembly'), findsOneWidget);
    expect(find.text('More Services'), findsOneWidget);

    // 7. Promo / Discount Banner
    expect(find.text('Flat 20% OFF'), findsOneWidget);
    expect(find.text('On Your First Booking'), findsOneWidget);
    expect(find.text('Use Code: HOME20'), findsOneWidget);

    // 8. Popular Services horizontal section
    expect(find.text('Popular Services', findRichText: true), findsOneWidget);
    expect(find.text('AC Service'), findsOneWidget);
    expect(find.text('₹499'), findsOneWidget);

    // 9. How HomeCareX Works 4-step stepper section
    expect(find.text('SIMPLE 4-STEP PROCESS'), findsOneWidget);
    expect(find.text('How HomeCareX Works', findRichText: true), findsOneWidget);
    expect(find.text('Explore All'), findsOneWidget);
    expect(find.text('Choose a Service'), findsOneWidget);
    expect(find.text('50+ Services'), findsOneWidget);
    expect(find.text('Schedule Date & Time'), findsOneWidget);
    expect(find.text('Same-Day Slots'), findsOneWidget);
    expect(find.text('Verified Expert Arrives'), findsOneWidget);
    expect(find.text('100% Verified'), findsOneWidget);
    expect(find.text('Inspect & Pay with Ease'), findsOneWidget);
    expect(find.text('30-Day Guarantee'), findsOneWidget);
    expect(find.text('Book a Service'), findsOneWidget);

    // 10. What Customers Say (Testimonials) section
    expect(find.text('TESTIMONIALS'), findsOneWidget);
    expect(find.text('What Customers Say'), findsOneWidget);
    expect(find.text('Lokesh D'), findsOneWidget);
    expect(find.text('Microwave Oven Repair'), findsOneWidget);
    expect(find.text('"Very good worker"'), findsOneWidget);
    expect(find.text('Verified Customer Booking'), findsWidgets);

    // 11. Frequently Asked Questions Carousel
    expect(find.text('GOT QUESTIONS?'), findsOneWidget);
    expect(find.textContaining('Frequently Asked', findRichText: true), findsOneWidget);
    expect(find.text('What services does HomeCareX provide?'), findsOneWidget);
    expect(find.text('More FAQs'), findsOneWidget);
    expect(find.text('Contact Support'), findsOneWidget);

    // 12. Bottom Promo / Action Cards Carousel
    expect(find.textContaining('Need help with your', findRichText: true), findsOneWidget);
    expect(find.text('Find reliable home services and make home maintenance simple, quick, and convenient.'), findsOneWidget);
    expect(find.text('Explore Services'), findsOneWidget);
    expect(find.text('Contact Us'), findsOneWidget);
  });

  testWidgets('Guest FAQ carousel navigates questions and Bottom Promo carousel slides', (tester) async {
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

    // Scroll down to FAQ section
    await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -1200));
    await tester.pumpAndSettle();

    // Verify initial FAQ question
    expect(find.text('What services does HomeCareX provide?'), findsOneWidget);

    // Tap right chevron to advance FAQ
    final rightChevron = find.byKey(const Key('faq_next_chevron'));
    expect(rightChevron, findsOneWidget);
    await tester.tap(rightChevron);
    await tester.pump();

    // Verify next question is shown
    expect(find.text('How can I book a service?'), findsOneWidget);

    // Tap left chevron to go back
    final leftChevron = find.byKey(const Key('faq_prev_chevron'));
    expect(leftChevron, findsOneWidget);
    await tester.tap(leftChevron);
    await tester.pump();

    expect(find.text('What services does HomeCareX provide?'), findsOneWidget);

    // Scroll down to Bottom Promo card
    await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -500));
    await tester.pumpAndSettle();

    // Verify initial Promo card
    expect(find.text('Explore Services'), findsOneWidget);
    expect(find.text('Contact Us'), findsOneWidget);

    // Swipe promo card to slide to Professional card
    await tester.drag(find.text('Explore Services'), const Offset(-400, 0));
    await tester.pumpAndSettle();

    expect(find.textContaining('Are you a service', findRichText: true), findsOneWidget);
    expect(find.text('Join as a Professional'), findsOneWidget);
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
    expect(find.text('Book trusted professionals for your home needs.'), findsOneWidget);
    expect(find.text('Quality Services at Your\nDoorstep'), findsOneWidget);
    expect(find.text('Verified Professionals'), findsOneWidget);
  });
}
