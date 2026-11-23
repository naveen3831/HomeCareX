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

  group('RazorpayTestCheckoutSheet Unit & Widget tests', () {
    testWidgets('renders Razorpay Test Mode header, amount and payment methods',
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
                    amount: 446.0,
                    serviceName: 'Shelf & Curtain Rod Installation',
                  );
                },
                child: const Text('Open Razorpay Checkout'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Open checkout
      await tester.tap(find.text('Open Razorpay Checkout'));
      await tester.pumpAndSettle();

      // 1. Verify Header
      expect(find.text('HomeCareX'), findsOneWidget);
      expect(find.text('TEST MODE'), findsOneWidget);
      expect(find.text('Payment for Shelf & Curtain Rod Installation'), findsOneWidget);
      expect(find.text('₹446'), findsOneWidget);
      expect(find.text('rzp_test_gateway'), findsOneWidget);

      // 2. Verify Payment Methods
      expect(find.text('PREFERRED PAYMENT METHODS'), findsOneWidget);
      expect(find.text('UPI / QR'), findsOneWidget);
      expect(find.text('Google Pay'), findsOneWidget);
      expect(find.text('PhonePe'), findsOneWidget);
      expect(find.text('Paytm'), findsOneWidget);
      expect(find.text('Cards (Credit / Debit)'), findsOneWidget);
      expect(find.text('Netbanking'), findsOneWidget);
      expect(find.text('Wallets'), findsOneWidget);
      expect(find.text('Pay ₹446'), findsOneWidget);
      expect(find.text('Secured by Razorpay • Test Environment'), findsOneWidget);
    });

    testWidgets('transitions to Demo Bank Page and returns Success when Success button is tapped',
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
                    amount: 446.0,
                    serviceName: 'Shelf & Curtain Rod Installation',
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

      // Tap Pay button to transition to demo bank
      await tester.tap(find.text('Pay ₹446'));
      await tester.pumpAndSettle();

      // Verify Demo Bank view matches mobile responsive screenshot specification
      expect(find.text('1'), findsOneWidget); // Big blue italic 1 glyph
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
      expect(find.text('Back to methods'), findsOneWidget);

      // Tap Success
      await tester.tap(find.text('Success'));
      await tester.pump();
      expect(find.text('Authorizing payment…'), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 700));
      await tester.pumpAndSettle();

      expect(result, isNotNull);
      expect(result!.success, isTrue);
      expect(result!.isCancelled, isFalse);
      expect(result!.paymentId, startsWith('pay_test_'));
    });

    testWidgets('returns Failure outcome when Failure button is tapped in demo bank',
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
                    amount: 446.0,
                    serviceName: 'Shelf & Curtain Rod Installation',
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

      // Tap Pay button
      await tester.tap(find.text('Pay ₹446'));
      await tester.pumpAndSettle();

      // Tap Failure
      await tester.tap(find.text('Failure'));
      await tester.pump();
      expect(find.text('Declining payment…'), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 700));
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

    testWidgets('shows RAZORPAY TEST badge and opens Razorpay Test Mode when Online Payment is selected',
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

      // Razorpay Checkout sheet opens
      expect(find.text('TEST MODE'), findsOneWidget);
      expect(find.text('Pay ₹441'), findsOneWidget);

      // Transition to Demo Bank
      await tester.tap(find.text('Pay ₹441'));
      await tester.pumpAndSettle();

      expect(
        find.text('Welcome to Razorpay Software Private Ltd Bank'),
        findsOneWidget,
      );

      // Complete with Success
      await tester.tap(find.text('Success'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));
      await tester.pumpAndSettle();

      // Verified booking confirmed!
      expect(find.text('Booking Confirmed!'), findsOneWidget);
      expect(find.text('Track Booking'), findsOneWidget);
      expect(bookingProvider.bookings.length, 1);
    });

    testWidgets('shows Payment Failed dialog when Failure is tapped in demo bank',
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

      // Transition to Demo Bank
      await tester.tap(find.text('Pay ₹441'));
      await tester.pumpAndSettle();

      // Tap Failure in Demo Bank
      await tester.tap(find.text('Failure'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 700));
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
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      // Booking confirmed with Cash on Service fallback
      expect(find.text('Booking Confirmed!'), findsOneWidget);
      expect(bookingProvider.bookings.length, 1);
    });
  });
}
