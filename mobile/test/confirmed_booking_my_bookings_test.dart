import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/screens/bookings/bookings_screen.dart';
import 'package:homecarex_mobile/screens/bookings/active_bookings_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('Confirmed booking updates immediately in My Bookings and Active Bookings',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final bookingProvider = BookingProvider();
    bookingProvider.syncRemote = false;

    // 1. Initially bookings list is empty
    expect(bookingProvider.bookings.isEmpty, isTrue);

    // 2. Create and confirm a booking
    final scheduledDate = DateTime.now().add(const Duration(days: 1));
    final success = await bookingProvider.createBooking(
      items: [
        {
          'serviceId': 'custom-shelf-installation',
          'name': 'Shelf & Curtain Rod Installation',
          'price': 349,
          'quantity': 1,
        }
      ],
      address: 'Flat 302, Manjeera Trinity, Deepthisree Nagar, Hyderabad - 500049',
      scheduledDate: scheduledDate,
      totalAmount: 349.0,
    );

    expect(success, isTrue);
    expect(bookingProvider.bookings.length, 1);

    final confirmedBooking = bookingProvider.bookings.first;
    expect(confirmedBooking.serviceTitle, 'Shelf & Curtain Rod Installation');
    expect(confirmedBooking.amount, 349.0);
    expect(confirmedBooking.status, 'confirmed');
    expect(confirmedBooking.address, contains('Deepthisree Nagar'));

    // 3. Mount BookingsScreen ("My Bookings")
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider.value(value: bookingProvider),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: const BookingsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify "My Bookings" displays the confirmed booking
    expect(find.text('My Bookings'), findsOneWidget);
    expect(find.text('Shelf & Curtain Rod Installation'), findsOneWidget);
    expect(find.text('₹349'), findsOneWidget);
    expect(find.text('CONFIRMED'), findsOneWidget);
    expect(find.textContaining('Deepthisree Nagar'), findsOneWidget);

    // 4. Mount ActiveBookingsScreen
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider.value(value: bookingProvider),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
          ),
          home: const ActiveBookingsScreen(autoFetch: false),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify Active Bookings screen shows the active confirmed booking
    expect(find.text('Active Bookings'), findsOneWidget);
    expect(find.text('Shelf & Curtain Rod Installation'), findsOneWidget);
    expect(find.text('₹349'), findsOneWidget);
    expect(find.text('Confirmed'), findsOneWidget);
  });
}
