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

  Widget createWidget({int initialStep = 1, bool initialAddingNewAddress = false}) {
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
          initialAddingNewAddress: initialAddingNewAddress,
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
    expect(find.text('₹ 600 per unit • 45 min'), findsOneWidget);

    // 5. Quantity Stepper
    expect(find.text('No. of Persons'), findsOneWidget);
    expect(find.text('Units to be serviced (up to 20)'), findsOneWidget);
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
    expect(find.text('Home'), findsWidgets);
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

  testWidgets('BookServiceFlowScreen Step 2 Add a new address map screen matches web screenshot',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(initialStep: 2, initialAddingNewAddress: true));
    await tester.pumpAndSettle();

    // 1. Top Bar, Pill Banner, Stepper Card & Header
    expect(find.text('Book Service'), findsOneWidget);
    expect(find.text('Step 2 of 4'), findsOneWidget);
    expect(find.text('Address Details'), findsOneWidget);
    expect(find.text('Next: Schedule'), findsOneWidget);
    expect(find.text('Choose Service Address'), findsOneWidget);
    expect(find.text('Choose where you\'d like the service performed.'), findsOneWidget);
    expect(find.text('Add a new address'), findsOneWidget);
    expect(find.text('Saved addresses'), findsOneWidget);

    // 2. Map Container & Search
    expect(find.text('Pin your location'), findsOneWidget);
    expect(find.text('Search for area, street or landmark...'), findsOneWidget);
    expect(find.byIcon(Icons.my_location_rounded), findsOneWidget);
    expect(find.text('© OpenStreetMap contributors'), findsOneWidget);

    // 3. Service Location Container
    expect(find.text('SERVICE LOCATION'), findsOneWidget);
    expect(find.text('HITEC City'), findsOneWidget);
    expect(
      find.textContaining('HITEC City - Kondapur Main Road'),
      findsOneWidget,
    );

    // 4. Helper Text, Form Fields & Action Buttons
    expect(
      find.text('Drag the map or search. We\'ll fill in the details below. You can still edit them.'),
      findsOneWidget,
    );
    expect(find.text('Save as'), findsOneWidget);
    expect(find.text('House / flat no.'), findsOneWidget);
    expect(find.text('Street / road'), findsOneWidget);
    expect(find.text('Area / locality (optional)'), findsOneWidget);
    expect(find.text('Landmark (optional)'), findsOneWidget);
    expect(find.text('City'), findsOneWidget);
    expect(find.text('State'), findsOneWidget);
    expect(find.text('Pincode'), findsOneWidget);
    expect(find.text('We serve Hyderabad'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
    expect(find.text('Save & select'), findsOneWidget);

    // 5. Test search query updating location and auto-filling fields
    final searchField = find.byWidgetPredicate(
      (w) => w is TextField && w.decoration?.hintText == 'Search for area, street or landmark...',
    );
    await tester.enterText(searchField, 'Kondapur');
    await tester.pumpAndSettle();
    expect(find.text('Kondapur'), findsWidgets);
    expect(find.textContaining('Raghavendra Colony'), findsWidgets);

    // 6. Test toggling "Save as" option
    await tester.tap(find.text('Work'));
    await tester.pumpAndSettle();

    // 7. Tap Save & select -> Advances to Step 3 (Date & Time)
    await tester.ensureVisible(find.text('Save & select'));
    await tester.tap(find.text('Save & select'));
    await tester.pumpAndSettle();

    expect(find.text('Date & Time'), findsOneWidget);
    expect(find.text('Select Date & Time'), findsOneWidget);
  });

  testWidgets('BookServiceFlowScreen toggles between Add a new address and Saved addresses',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    // Start on Map view
    await tester.pumpWidget(createWidget(initialStep: 2, initialAddingNewAddress: true));
    await tester.pumpAndSettle();
    expect(find.text('Pin your location'), findsOneWidget);

    // Tap "Saved addresses" button to switch to saved list view
    await tester.tap(find.text('Saved addresses'));
    await tester.pumpAndSettle();
    expect(find.text('Choose Service Address'), findsOneWidget);
    expect(find.text('Home'), findsWidgets);

    // Tap "Add a new address" banner to switch back to Map view
    await tester.tap(find.text('Add a new address'));
    await tester.pumpAndSettle();
    expect(find.text('Pin your location'), findsOneWidget);
    await tester.ensureVisible(find.text('Save & select'));
    expect(find.text('Save & select'), findsOneWidget);
  });

  testWidgets('BookServiceFlowScreen map supports real-time dragging, zoom controls, and locate reset',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(initialStep: 2, initialAddingNewAddress: true));
    await tester.pumpAndSettle();

    // 1. Verify zoom control buttons exist
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
    expect(find.byIcon(Icons.remove_rounded), findsOneWidget);

    // 2. Tap zoom in (+) and unzoom (-) buttons
    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.remove_rounded));
    await tester.pumpAndSettle();

    // Initial location is HITEC City
    expect(find.text('HITEC City'), findsWidgets);

    // 3. Drag the map canvas in real-time
    final mapFinder = find.byWidgetPredicate(
      (w) => w is GestureDetector && w.onScaleStart != null,
    );

    // Perform real-time pan/drag
    await tester.drag(mapFinder, const Offset(-180, 0));
    await tester.pumpAndSettle();

    // Verify location updated in real-time
    expect(find.text('HITEC City'), findsNothing);

    // 4. Tap locate me button to reset
    await tester.tap(find.byIcon(Icons.my_location_rounded));
    await tester.pumpAndSettle();

    // Verify reset to default HITEC City
    expect(find.text('HITEC City'), findsWidgets);
  });

  testWidgets('BookServiceFlowScreen Step 1 matches Shelf & Curtain Rod reference screenshot',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final shelfService = ServiceModel(
      id: 'srv_shelf_install',
      name: 'Shelf & Curtain Rod Installation',
      slug: 'custom-shelf-installation',
      description: 'Drill-and-fix wall shelves, curtain rods and TV brackets.',
      price: 349.0,
      categoryId: 'cat_carpentry',
      durationMinutes: 45,
      rating: 4.8,
      reviewsCount: 42,
    );

    await tester.pumpWidget(MultiProvider(
      providers: [
        ChangeNotifierProvider<BookingProvider>(create: (_) => FakeBookingProvider()),
      ],
      child: MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: InkRipple.splashFactory,
        ),
        home: BookServiceFlowScreen(
          service: shelfService,
          initialStep: 1,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    // 1. Top Bar
    expect(find.text('Book Service'), findsOneWidget);

    // 2. Service Pill
    expect(find.text('Shelf & Curtain Rod Installation'), findsWidgets);

    // 3. Stepper Card
    expect(find.text('Step 1 of 4'), findsOneWidget);
    expect(find.text('Service Details'), findsOneWidget);
    expect(find.text('Next: Address'), findsOneWidget);

    // 4. Content Card
    expect(find.text('What do you need done?'), findsOneWidget);
    expect(find.text('Carpentry & Furniture Assembly'), findsOneWidget);
    expect(find.text('₹ 349 per unit • 45 min'), findsOneWidget);
    expect(find.text('Units to be serviced (up to 20)'), findsOneWidget);

    // 5. Sticky Bottom Bar
    expect(find.text('Running Estimate'), findsOneWidget);
    expect(find.text('₹349'), findsOneWidget);
    expect(find.text('Next Step →'), findsOneWidget);

    // 6. Persistent Bottom Nav Bar
    expect(find.text('Categories'), findsOneWidget);
    expect(find.text('Services'), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('My Bookings'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
  });
}

