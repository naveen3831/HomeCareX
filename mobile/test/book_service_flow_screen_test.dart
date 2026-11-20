import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:homecarex_mobile/core/models/service_model.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/screens/bookings/book_service_flow_screen.dart';

class FakeBookingProvider extends BookingProvider {
  @override
  Future<bool> createBooking({
    required List<Map<String, dynamic>> items,
    required String address,
    required DateTime scheduledDate,
    required double totalAmount,
  }) async {
    return true;
  }
}

void main() {
  final testService = ServiceModel(
    id: 'srv_haircut_styling',
    name: 'Haircut & Styling',
    slug: 'haircut-styling',
    description: 'Expert haircut, washing, and professional hair styling.',
    price: 600.0,
    categoryId: 'cat_salon_spa',
    durationMinutes: 45,
    rating: 4.9,
    reviewsCount: 128,
  );

  Widget createWidget({int initialStep = 1}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<BookingProvider>(create: (_) => FakeBookingProvider()),
      ],
      child: MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: InkRipple.splashFactory,
        ),
        home: BookServiceFlowScreen(
          service: testService,
          initialStep: initialStep,
        ),
      ),
    );
  }

  testWidgets('BookServiceFlowScreen Step 1 displays all elements matching web screenshot',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(initialStep: 1));
    await tester.pumpAndSettle();

    // 1. Top Bar
    expect(find.text('Book Service'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Service Pill
    expect(find.text('Haircut & Styling'), findsWidgets);

    // 3. Stepper Card
    expect(find.text('Step 1 of 4'), findsOneWidget);
    expect(find.text('Service Details'), findsOneWidget);
    expect(find.text('Next: Address'), findsOneWidget);

    // 4. Content Card
    expect(find.text('What do you need done?'), findsOneWidget);
    expect(
      find.text('Set the quantity and pick any extras for this visit.'),
      findsOneWidget,
    );
    expect(find.text('₹600 per unit • ⏱ 45 min'), findsOneWidget);

    // 5. Quantity Stepper
    expect(find.text('No. of Persons'), findsOneWidget);
    expect(find.text('Units to be serviced (up to 10)'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    expect(find.byIcon(Icons.remove_rounded), findsOneWidget);
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);

    // 6. Bottom Sticky Bar
    expect(find.text('Running Estimate'), findsOneWidget);
    expect(find.text('₹600'), findsOneWidget);
    expect(find.text('Next Step →'), findsOneWidget);
  });

  testWidgets('BookServiceFlowScreen Step 1 quantity modifies running estimate',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(initialStep: 1));
    await tester.pumpAndSettle();

    // Tap + to increment quantity
    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();

    expect(find.text('2'), findsOneWidget);
    expect(find.text('₹1200'), findsOneWidget);

    // Tap - to decrement quantity
    await tester.tap(find.byIcon(Icons.remove_rounded));
    await tester.pumpAndSettle();

    expect(find.text('1'), findsOneWidget);
    expect(find.text('₹600'), findsOneWidget);
  });

  testWidgets('BookServiceFlowScreen Step 2 displays address details matching web screenshot',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(initialStep: 2));
    await tester.pumpAndSettle();

    // Stepper Card
    expect(find.text('Address Details'), findsOneWidget);
    expect(find.text('Next: Schedule'), findsOneWidget);
    expect(find.text('Step 2 of 4'), findsOneWidget);

    // Address Content
    expect(find.text('Choose Service Address'), findsOneWidget);
    expect(
      find.text('Choose where you\'d like the service performed.'),
      findsOneWidget,
    );
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Office'), findsOneWidget);
    expect(find.text('Add a new address'), findsOneWidget);

    // Bottom Bar
    expect(find.text('Next Step →'), findsOneWidget);
  });

  testWidgets('BookServiceFlowScreen advances from Step 1 to Step 4 and confirms booking',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(initialStep: 1));
    await tester.pumpAndSettle();

    // Step 1 -> Step 2
    await tester.tap(find.text('Next Step →'));
    await tester.pumpAndSettle();
    expect(find.text('Address Details'), findsOneWidget);

    // Step 2 -> Step 3
    await tester.tap(find.text('Next Step →'));
    await tester.pumpAndSettle();
    expect(find.text('Date & Time'), findsOneWidget);
    expect(find.text('Select Date & Time'), findsOneWidget);

    // Step 3 -> Step 4
    await tester.tap(find.text('Next Step →'));
    await tester.pumpAndSettle();
    expect(find.text('Review & Pay'), findsWidgets);
    expect(find.text('Booking Summary'), findsOneWidget);
    expect(find.text('Payment Method'), findsOneWidget);
    expect(find.text('Bill Details'), findsOneWidget);
    expect(find.text('Confirm Booking ✓'), findsOneWidget);

    // Tap Confirm Booking
    await tester.tap(find.text('Confirm Booking ✓'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Booking Confirmed!'), findsOneWidget);
    expect(find.text('Track Booking'), findsOneWidget);
  });
}

