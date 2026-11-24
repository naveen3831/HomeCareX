import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:homecarex_mobile/core/models/service_model.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/screens/catalog/services_screen.dart';
import 'package:homecarex_mobile/screens/catalog/service_details_screen.dart';
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

class FakeCatalogProvider extends CatalogProvider {
  @override
  Future<void> fetchCatalog() async {
    // Keep offline fallback catalog without network requests
  }
}

void main() {
  final testService = ServiceModel(
    id: 'srv_shelf_install',
    name: 'Shelf & Curtain Rod Installation',
    slug: 'custom-shelf-installation',
    description: 'Drill-and-fix wall shelves, curtain rods and TV brackets.',
    price: 349.0,
    categoryId: 'cat_carpentry',
    durationMinutes: 45,
    rating: 0.0,
    reviewsCount: 0,
  );

  Widget createWidget({Widget? home}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider()),
        ChangeNotifierProvider<CatalogProvider>(create: (_) => FakeCatalogProvider()),
        ChangeNotifierProvider<BookingProvider>(create: (_) => FakeBookingProvider()),
      ],
      child: MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: InkRipple.splashFactory,
        ),
        home: home ?? const ServicesScreen(),
      ),
    );
  }

  testWidgets(
      'Clicking Book now on service card opens Service Details, then clicking Book now opens 4-step flow',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget());
    await tester.pumpAndSettle();

    // 1. Verify on ServicesScreen we find services and "Book now" button
    expect(find.text('Deep Home Cleaning'), findsWidgets);
    final bookNowButtons = find.text('Book now');
    expect(bookNowButtons, findsWidgets);

    // 2. Click the first "Book now" button on the service card in ServicesScreen
    await tester.tap(bookNowButtons.first);
    await tester.pumpAndSettle();

    // 3. Verify it navigated to ServiceDetailsScreen
    expect(find.byType(ServiceDetailsScreen), findsOneWidget);
    expect(find.text('Service details'), findsOneWidget);
    expect(find.text('Slots open this week'), findsOneWidget);
    expect(find.text('Earliest: Today'), findsOneWidget);
    expect(find.text('Starting at'), findsOneWidget);

    // 4. On ServiceDetailsScreen, click the bottom bar "Book now" button
    final detailsBookNowBtn = find.widgetWithText(ElevatedButton, 'Book now');
    expect(detailsBookNowBtn, findsOneWidget);
    await tester.tap(detailsBookNowBtn);
    await tester.pumpAndSettle();

    // 5. Verify it navigated to BookServiceFlowScreen Step 1
    expect(find.byType(BookServiceFlowScreen), findsOneWidget);
    expect(find.text('Step 1 of 4'), findsOneWidget);
    expect(find.text('Service Details'), findsOneWidget);
    expect(find.text('What do you need done?'), findsOneWidget);
    expect(find.text('Next Step →'), findsOneWidget);
  });

  testWidgets(
      'ServiceDetailsScreen shows New service when reviewsCount is 0',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(createWidget(home: ServiceDetailsScreen(service: testService)));
    await tester.pumpAndSettle();

    expect(find.text('Service details'), findsOneWidget);
    expect(find.text('Shelf & Curtain Rod Installation'), findsOneWidget);
    expect(find.text('Carpentry & Furniture Assembly'), findsOneWidget);
    expect(find.text('New service'), findsOneWidget);
    expect(find.text('45 mins'), findsOneWidget);
    expect(find.text('Slots open this week'), findsOneWidget);
    expect(find.text('Earliest: Today'), findsOneWidget);
    expect(find.text('Starting at'), findsOneWidget);
    expect(find.text('₹349'), findsOneWidget);
  });
}
