import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/core/models/service_model.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/providers/notification_provider.dart';
import 'package:homecarex_mobile/screens/bookings/book_service_flow_screen.dart';
import 'package:homecarex_mobile/screens/payments/razorpay_test_checkout_sheet.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
  });

  group('Razorpay Checkout Screen & Demo Bank Dialog tests (media_1795424344222_1a10f3fb.jpg & media_1795424348300_d5fbfdda.jpg)', () {
    testWidgets('renders Razorpay mobile checkout screen matching media_1795424344222_1a10f3fb.jpg',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: const RazorpayCheckoutScreen(
            amount: 742.0,
            serviceName: 'Haircut & Styling',
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 1. Top Bar
      expect(find.text('HomeCareX'), findsOneWidget);
      expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);
      expect(find.byIcon(Icons.person_rounded), findsOneWidget);

      // 2. Section: Payment Options
      expect(find.text('Payment Options'), findsOneWidget);

      // 3. UPI QR Box
      expect(find.text('UPI QR'), findsOneWidget);
      expect(find.text('11:55'), findsOneWidget);
      expect(find.text('Scan the QR using any UPI App'), findsOneWidget);

      // 4. All Payment Options list
      expect(find.text('All Payment Options'), findsOneWidget);
      expect(find.text('UPI'), findsOneWidget);
      expect(find.text('Cards'), findsOneWidget);
      expect(find.text('EMI'), findsOneWidget);
      expect(find.text('Netbanking'), findsOneWidget);
      expect(find.text('Wallet'), findsOneWidget);

      // 5. Sticky Bottom Bar
      expect(find.text('₹742'), findsOneWidget);
      expect(find.text('View Details'), findsOneWidget);
      expect(find.text('Continue'), findsOneWidget);
    });

    testWidgets('View Details modal opens when tapping View Details',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: const RazorpayCheckoutScreen(
            amount: 742.0,
            serviceName: 'Haircut & Styling',
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('View Details'));
      await tester.pumpAndSettle();

      expect(find.text('Payment Details'), findsOneWidget);
      expect(find.text('Haircut & Styling'), findsOneWidget);
      expect(find.text('Total Payable'), findsOneWidget);
    });

    testWidgets('tapping Continue opens Demo Bank Dialog matching media_1795424348300_d5fbfdda.jpg and Success returns valid result',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      RazorpayCheckoutResult? result;

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  result = await RazorpayTestCheckoutSheet.show(
                    context: context,
                    amount: 742.0,
                    serviceName: 'Haircut & Styling',
                  );
                },
                child: const Text('Open Razorpay Checkout'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Launch screen
      await tester.tap(find.text('Open Razorpay Checkout'));
      await tester.pumpAndSettle();

      // Tap Continue button
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      // Verify Demo Bank Dialog (media_1795424348300_d5fbfdda.jpg)
      expect(find.text('1'), findsOneWidget); // Blue italic 1 glyph
      expect(
        find.text('Welcome to Razorpay Software Private Ltd Bank'),
        findsOneWidget,
      );
      expect(find.text('This is just a demo bank page.'), findsOneWidget);
      expect(
        find.text('You can choose whether to make this payment successful or not:'),
        findsOneWidget,
      );
      expect(find.text('Success'), findsOneWidget);
      expect(find.text('Failure'), findsOneWidget);

      // Tap Success
      await tester.tap(find.text('Success'));
      await tester.pumpAndSettle();

      expect(result, isNotNull);
      expect(result!.success, isTrue);
      expect(result!.isCancelled, isFalse);
      expect(result!.paymentId, startsWith('pay_test_'));
    });

    testWidgets('tapping Failure in Demo Bank Dialog returns Failure outcome',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      RazorpayCheckoutResult? result;

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  result = await RazorpayTestCheckoutSheet.show(
                    context: context,
                    amount: 742.0,
                    serviceName: 'Haircut & Styling',
                  );
                },
                child: const Text('Open Checkout'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Checkout'));
      await tester.pumpAndSettle();

      // Tap Continue button
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      // Tap Failure
      await tester.tap(find.text('Failure'));
      await tester.pumpAndSettle();

      expect(result, isNotNull);
      expect(result!.success, isFalse);
      expect(result!.isCancelled, isFalse);
      expect(result!.error, contains('declined'));
    });
  });

  group('BookServiceFlowScreen Razorpay Test Mode integration', () {
    final testService = ServiceModel(
      id: 'custom-shelf-installation',
      categoryId: 'carpentry',
      name: 'Shelf & Curtain Rod Installation',
      slug: 'custom-shelf-installation',
      description: 'Professional home decorating for curtain and shelf mounting.',
      price: 349.0,
      durationMinutes: 45,
      rating: 4.8,
      reviewsCount: 124,
    );

    Widget createTestWidget({
      required BookingProvider bookingProvider,
      required NotificationProvider notifProvider,
    }) {
      return MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider.value(value: bookingProvider),
          ChangeNotifierProvider.value(value: notifProvider),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: BookServiceFlowScreen(
            service: testService,
            initialStep: 4, // Review & Pay step
          ),
        ),
      );
    }

    testWidgets('shows RAZORPAY TEST badge, opens Razorpay Checkout and confirms on Success',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final bookingProvider = BookingProvider()..syncRemote = false;
      final notifProvider = NotificationProvider()..syncRemote = false;

      await tester.pumpWidget(
        createTestWidget(
          bookingProvider: bookingProvider,
          notifProvider: notifProvider,
        ),
      );
      await tester.pumpAndSettle();

      // Step 4 Review & Pay
      expect(find.text('Review & Pay'), findsWidgets);
      expect(find.text('Payment Method'), findsOneWidget);
      expect(find.text('RAZORPAY TEST'), findsOneWidget);

      // Select "Online Payment / UPI"
      await tester.tap(find.text('Online Payment / UPI'));
      await tester.pumpAndSettle();

      // Tap Confirm Booking
      await tester.tap(find.text('Confirm Booking ✓'));
      await tester.pumpAndSettle();

      // Razorpay Checkout screen opens matching media_1795424344222_1a10f3fb.jpg
      expect(find.text('Payment Options'), findsOneWidget);
      expect(find.text('Continue'), findsOneWidget);

      // Tap Continue to open Demo Bank Dialog (media_1795424348300_d5fbfdda.jpg)
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(
        find.text('Welcome to Razorpay Software Private Ltd Bank'),
        findsOneWidget,
      );

      // Complete with Success
      await tester.tap(find.text('Success'));
      await tester.pumpAndSettle();

      // Verified booking confirmed!
      expect(find.text('Booking Confirmed!'), findsOneWidget);
      expect(find.text('Track Booking'), findsOneWidget);
      expect(bookingProvider.bookings.length, 1);
    });

    testWidgets('shows Payment Failed dialog when Failure is tapped and allows Cash on Service fallback',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final bookingProvider = BookingProvider()..syncRemote = false;
      final notifProvider = NotificationProvider()..syncRemote = false;

      await tester.pumpWidget(
        createTestWidget(
          bookingProvider: bookingProvider,
          notifProvider: notifProvider,
        ),
      );
      await tester.pumpAndSettle();

      // Select "Online Payment / UPI"
      await tester.tap(find.text('Online Payment / UPI'));
      await tester.pumpAndSettle();

      // Tap Confirm Booking
      await tester.tap(find.text('Confirm Booking ✓'));
      await tester.pumpAndSettle();

      // Tap Continue
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      // Tap Failure in Demo Bank
      await tester.tap(find.text('Failure'));
      await tester.pumpAndSettle();

      // Payment Failed dialog appears with recovery options
      expect(find.text('Payment Failed'), findsOneWidget);
      expect(
        find.text('Your payment of ₹441 was declined by the demo bank.'),
        findsOneWidget,
      );
      expect(find.text('Try Again'), findsOneWidget);
      expect(find.text('Pay with Cash on Service'), findsOneWidget);

      // Tap "Pay with Cash on Service" recovery button
      await tester.tap(find.text('Pay with Cash on Service'));
      await tester.pumpAndSettle();

      // Booking confirmed with Cash on Service fallback
      expect(find.text('Booking Confirmed!'), findsOneWidget);
      expect(bookingProvider.bookings.length, 1);
    });
  });
}
