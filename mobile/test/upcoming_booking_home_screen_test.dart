import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/screens/home/home_screen.dart';
import 'package:homecarex_mobile/screens/bookings/booking_tracking_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget createTestWidget(BookingProvider bookingProvider) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider.value(value: bookingProvider),
      ],
      child: const MaterialApp(
        home: HomeScreen(),
      ),
    );
  }

  testWidgets('HomeScreen displays Welcome card when no active bookings exist', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final bookingProvider = BookingProvider();
    bookingProvider.syncRemote = false;

    await tester.pumpWidget(createTestWidget(bookingProvider));
    await tester.pumpAndSettle();

    // Verify Welcome card is visible and Upcoming is not
    expect(find.text('Welcome to HomeCareX!'), findsOneWidget);
    expect(find.text("You haven't booked a service yet. Pick a category below to get started."), findsOneWidget);
    expect(find.text('• Add address'), findsOneWidget);
    expect(find.text('Upcoming'), findsNothing);
  });

  testWidgets('HomeScreen displays Upcoming section when a booking is created', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final bookingProvider = BookingProvider();
    bookingProvider.syncRemote = false;

    // Create a confirmed booking
    final scheduledDate = DateTime.now().add(const Duration(days: 2));
    await bookingProvider.createBooking(
      items: [
        {
          'serviceId': 'custom-shelf-installation',
          'name': 'Shelf & Curtain Rod Installation',
          'price': 446,
          'quantity': 1,
        }
      ],
      address: 'Flat 402, Sri Sai Nilayam, Madhapur, Hyderabad - 500081',
      scheduledDate: scheduledDate,
      totalAmount: 446.0,
    );

    await tester.pumpWidget(createTestWidget(bookingProvider));
    await tester.pumpAndSettle();

    // Verify Upcoming section is shown matching reference design
    expect(find.text('Upcoming'), findsOneWidget);
    expect(find.text('View all'), findsWidgets);
    expect(find.text('Shelf & Curtain Rod Installation'), findsOneWidget);
    expect(find.text('Partner Assigned'), findsOneWidget);
    expect(find.text('₹446'), findsOneWidget);
    expect(find.textContaining('Sri Sai Nilayam'), findsWidgets);

    // Verify Top Header updates with Home address and badge
    expect(find.text('• Home'), findsOneWidget);
    expect(find.text('1'), findsOneWidget); // badge count

    // Verify Welcome card is NOT shown
    expect(find.text('Welcome to HomeCareX!'), findsNothing);

    // Verify tapping the Upcoming booking card navigates to BookingTrackingScreen
    await tester.tap(find.text('Shelf & Curtain Rod Installation'));
    await tester.pumpAndSettle();

    expect(find.byType(BookingTrackingScreen), findsOneWidget);
  });
}
