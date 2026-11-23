import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/core/models/address_model.dart';
import 'package:homecarex_mobile/core/models/service_model.dart';
import 'package:homecarex_mobile/providers/address_provider.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/notification_provider.dart';
import 'package:homecarex_mobile/screens/bookings/booking_success_screen.dart';
import 'package:homecarex_mobile/screens/bookings/bookings_screen.dart';
import 'package:provider/provider.dart';

void main() {
  final sampleService = ServiceModel(
    id: 'srv-haircut',
    name: 'Haircut & Styling',
    slug: 'haircut-styling',
    description: 'Professional home cleaning for a cleaner and healthier home.',
    price: 742,
    rating: 4.8,
    reviewsCount: 120,
    categoryId: 'cat-salon',
    imageUrl: '',
    durationMinutes: 60,
  );

  final sampleAddress = CustomerAddress(
    id: 'addr-1',
    label: 'Home',
    house: '000000',
    street: 'Image Garden road',
    area: 'Ayyappa Society Colony',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500081',
    isDefault: true,
  );

  Widget createWidget({
    String bookingId = '6b0400371557d39df92a97c6',
    bool isCod = false,
    String paymentMethod = 'Net banking',
    double totalAmount = 742.0,
  }) {
    final authProv = AuthProvider();
    final bookingProv = BookingProvider()..syncRemote = false;
    final notifProv = NotificationProvider()..syncRemote = false;
    final addrProv = AddressProvider()..syncRemote = false;

    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authProv),
        ChangeNotifierProvider.value(value: bookingProv),
        ChangeNotifierProvider.value(value: notifProv),
        ChangeNotifierProvider.value(value: addrProv),
      ],
      child: MaterialApp(
        theme: ThemeData(
          splashFactory: NoSplash.splashFactory,
        ),
        home: BookingSuccessScreen(
          bookingId: bookingId,
          service: sampleService,
          selectedAddress: sampleAddress,
          selectedDate: DateTime(2026, 11, 23, 16, 0),
          selectedSlot: '16:00-18:00',
          paymentMethod: paymentMethod,
          totalAmount: totalAmount,
          isCod: isCod,
          createdAt: DateTime(2026, 11, 23, 14, 38),
        ),
      ),
    );
  }

  testWidgets('BookingSuccessScreen renders all elements matching web screenshot',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    // 1. Top Location Header
    expect(find.text('Deliver to '), findsOneWidget);
    expect(find.text('• Home'), findsOneWidget);
    expect(find.textContaining('Image Garden road'), findsWidgets);

    // 2. Banner Card
    expect(find.text('Booking Confirmed!'), findsOneWidget);
    expect(find.textContaining('Your service has been booked successfully'), findsOneWidget);
    expect(find.textContaining('HomeCareX'), findsOneWidget);

    // 3. Booking Details Card
    expect(find.text('Booking Details'), findsOneWidget);
    expect(find.text('Confirmed'), findsOneWidget);
    expect(find.text('Service'), findsOneWidget);
    expect(find.text('Haircut & Styling'), findsOneWidget);
    expect(find.text('Professional home cleaning for a cleaner and healthier home.'), findsOneWidget);

    // 2x2 Info Grid
    expect(find.text('Date & Time'), findsOneWidget);
    expect(find.text('November 23, 2026'), findsOneWidget);
    expect(find.text('04:00 PM - 06:00 PM'), findsWidgets);

    expect(find.text('Service Address'), findsOneWidget);
    expect(find.text('Payment Method'), findsOneWidget);
    expect(find.text('Net banking'), findsOneWidget);
    expect(find.text('Payment Status'), findsOneWidget);
    expect(find.text('Paid online'), findsOneWidget);

    // Highlight Strip
    expect(find.text('BOOKING REFERENCE'), findsOneWidget);
    expect(find.text('#2A97C6'), findsOneWidget);
    expect(find.text('TOTAL AMOUNT'), findsOneWidget);
    expect(find.text('₹742'), findsOneWidget);

    // 4. Progress Tracker Card
    expect(find.text('Booking Confirmed'), findsOneWidget);
    expect(find.textContaining('Nov 23, 2026 • 02:38 PM'), findsOneWidget);
    expect(find.text('Service Visit'), findsOneWidget);

    // 5. Action Buttons
    expect(find.text('View My Bookings'), findsOneWidget);
    expect(find.text('Track Booking'), findsOneWidget);
    expect(find.text('Return to Home'), findsOneWidget);
  });

  testWidgets('BookingSuccessScreen renders Order Placed for Cash on Service',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(
      isCod: true,
      paymentMethod: 'Cash on Service',
      totalAmount: 441,
    ));
    await tester.pumpAndSettle();

    expect(find.text('Order Placed!'), findsOneWidget);
    expect(find.text('Pay on service'), findsOneWidget);
    expect(find.text('Cash on Service'), findsOneWidget);
    expect(find.text('₹441'), findsOneWidget);
  });

  testWidgets('Tapping View My Bookings navigates to BookingsScreen',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    await tester.tap(find.text('View My Bookings'));
    await tester.pumpAndSettle();

    expect(find.byType(BookingsScreen), findsOneWidget);
  });
}
