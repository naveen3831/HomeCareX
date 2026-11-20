import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/screens/payments/payments_screen.dart';

void main() {
  testWidgets('PaymentsScreen displays all elements matching web screenshot',
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
          splashFactory: InkRipple.splashFactory,
        ),
        home: const PaymentsScreen(autoFetch: false),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Verify Top Bar
    expect(find.text('Payments'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);
    expect(find.text('Export'), findsOneWidget);

    // 2. Verify Top Info Banner
    expect(
      find.text('Every payment for your bookings, with receipts.'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.account_balance_wallet_rounded), findsOneWidget);

    // 3. Verify Filter Pills
    expect(find.text('All'), findsOneWidget);
    expect(find.text('Paid'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Failed'), findsOneWidget);
    expect(find.text('Refunded'), findsOneWidget);

    // 4. Verify Empty State matching screenshot
    expect(find.text('No payments yet'), findsOneWidget);
    expect(
      find.text(
        'Your payments and receipts will show up here after your first booking.',
      ),
      findsOneWidget,
    );
    expect(find.text('Browse services'), findsOneWidget);
    expect(find.byIcon(Icons.inbox_outlined), findsOneWidget);

    // 5. Switch filter to 'Pending'
    await tester.tap(find.text('Pending'));
    await tester.pumpAndSettle();

    expect(find.text('No payments match this filter'), findsOneWidget);
    expect(find.text('Try a different status filter.'), findsOneWidget);
    expect(find.text('Show all payments'), findsOneWidget);

    // 6. Tap 'Show all payments' button to reset
    await tester.tap(find.text('Show all payments'));
    await tester.pumpAndSettle();

    expect(find.text('No payments yet'), findsOneWidget);
    expect(find.text('Browse services'), findsOneWidget);

    // 7. Tap Export button to verify Export modal sheet
    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();

    expect(find.text('Export Payment Receipts'), findsOneWidget);
    expect(find.text('Export as CSV'), findsOneWidget);
    expect(find.text('Export as PDF Statement'), findsOneWidget);
  });
}

