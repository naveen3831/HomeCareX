import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/screens/wallet/wallet_screen.dart';

void main() {
  testWidgets('WalletScreen displays all elements matching web screenshot',
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
        home: const WalletScreen(autoFetch: false),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Verify Top Bar
    expect(find.text('Wallet'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Verify Header subtitle description
    expect(
      find.text('Manage your balance, refunds and rewards'),
      findsOneWidget,
    );

    // 3. Verify Balance Card
    expect(find.text('Wallet Balance'), findsOneWidget);
    expect(find.text('₹0.00'), findsOneWidget);
    expect(find.text('Available balance'), findsOneWidget);
    expect(find.byIcon(Icons.info_outline_rounded), findsOneWidget);
    expect(find.byIcon(Icons.account_balance_wallet_outlined), findsOneWidget);

    // 4. Verify Quick Actions Section
    expect(find.text('Quick Actions'), findsOneWidget);
    expect(find.text('Add Money'), findsOneWidget);
    expect(find.text('Top up your wallet'), findsOneWidget);
    expect(find.text('View Transactions'), findsOneWidget);
    expect(find.text('See all your transactions'), findsOneWidget);
    expect(find.text('Referral Rewards'), findsNWidgets(2)); // Quick action + filter pill
    expect(find.text('Invite friends & earn'), findsOneWidget);

    // 5. Verify Filter Pills
    expect(find.text('All'), findsOneWidget);
    expect(find.text('Credits'), findsOneWidget);
    expect(find.text('Debits'), findsOneWidget);

    // 6. Verify Empty State
    expect(find.text('Recent Transactions'), findsOneWidget);
    expect(find.text('No wallet activity yet'), findsOneWidget);
    expect(
      find.text('Refunds, referral rewards and credits will appear here.'),
      findsOneWidget,
    );

    // 7. Test Add Money Modal
    await tester.tap(find.text('Add Money'));
    await tester.pumpAndSettle();

    expect(find.text('Add Money to Wallet'), findsOneWidget);
    expect(find.text('+₹500'), findsOneWidget);
    expect(find.text('+₹1000'), findsOneWidget);
    expect(find.text('Proceed to Top Up'), findsOneWidget);

    // Tap Proceed to Top Up
    await tester.tap(find.text('Proceed to Top Up'));
    await tester.pumpAndSettle();

    // Verify balance updated and success banner appeared
    expect(find.text('₹500.00'), findsOneWidget);
    expect(find.text('Wallet Top-up'), findsOneWidget);
    expect(find.text('+₹500.00'), findsOneWidget);
  });
}
