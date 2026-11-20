import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:homecarex_mobile/core/models/booking_model.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/screens/bookings/active_bookings_screen.dart';
import 'package:homecarex_mobile/screens/bookings/bookings_screen.dart';
import 'package:homecarex_mobile/screens/catalog/services_screen.dart';

void main() {
  testWidgets('ActiveBookingsScreen displays empty state matching web screenshot',
      (WidgetTester tester) async {
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
          ChangeNotifierProvider(create: (_) => BookingProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const ActiveBookingsScreen(
            autoFetch: false,
            initialBookings: [],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Top Bar
    expect(find.text('Active Bookings'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Empty State Icon and Text
    expect(find.byIcon(Icons.inbox_outlined), findsOneWidget);
    expect(find.text('No active bookings to track'), findsOneWidget);
    expect(
      find.text(
        'You don\'t have any live bookings at the moment. Once a partner is assigned or en route, you can track them here.',
      ),
      findsOneWidget,
    );

    // 3. Action Buttons
    expect(find.text('My Bookings'), findsOneWidget);
    expect(find.text('Browse Services'), findsOneWidget);
  });

  testWidgets('ActiveBookingsScreen My Bookings button navigates to BookingsScreen',
      (WidgetTester tester) async {
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
          ChangeNotifierProvider(create: (_) => BookingProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const ActiveBookingsScreen(
            autoFetch: false,
            initialBookings: [],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('My Bookings'));
    await tester.pumpAndSettle();

    expect(find.byType(BookingsScreen), findsOneWidget);
  });

  testWidgets('ActiveBookingsScreen Browse Services button navigates to ServicesScreen',
      (WidgetTester tester) async {
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
          ChangeNotifierProvider(create: (_) => BookingProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const ActiveBookingsScreen(
            autoFetch: false,
            initialBookings: [],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Browse Services'));
    await tester.pumpAndSettle();

    expect(find.byType(ServicesScreen), findsOneWidget);
  });

  testWidgets('ActiveBookingsScreen displays active booking card when bookings exist',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final testBooking = BookingModel(
      id: 'book-123456',
      serviceTitle: 'Deep Home Cleaning',
      amount: 1499.0,
      status: 'assigned',
      scheduledAt: DateTime.now().add(const Duration(hours: 2)),
      address: 'Flat 402, Green Glen Apartments, Bengaluru',
      partnerName: 'Rajesh Kumar',
      partnerPhone: '9876543210',
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => BookingProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: ActiveBookingsScreen(
            autoFetch: false,
            initialBookings: [testBooking],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Partner Assigned'), findsOneWidget);
    expect(find.text('Deep Home Cleaning'), findsOneWidget);
    expect(find.text('Partner Rajesh Kumar assigned'), findsOneWidget);
    expect(find.text('Track Live'), findsOneWidget);
  });
}
