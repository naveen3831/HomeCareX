import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/screens/profile/notifications_settings_screen.dart';

void main() {
  testWidgets('NotificationsSettingsScreen displays all sections and options',
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
        home: const NotificationsSettingsScreen(autoFetch: false),
      ),
    );
    await tester.pumpAndSettle();

    // 1. App Bar
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Inbox Banner Card
    expect(find.text('Notification Inbox'), findsOneWidget);
    expect(
      find.text('View all your received booking updates & alerts'),
      findsOneWidget,
    );
    expect(find.text('Open →'), findsOneWidget);

    // 3. Language Section
    expect(find.text('LANGUAGE'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);
    expect(find.text('हिन्दी (Hindi)'), findsOneWidget);
    expect(find.text('తెలుగు (Telugu)'), findsOneWidget);

    // 4. Notify Me About Section
    expect(find.text('NOTIFY ME ABOUT'), findsOneWidget);
    expect(find.text('Bookings'), findsOneWidget);
    expect(find.text('Payments'), findsOneWidget);
    expect(find.text('Offers'), findsOneWidget);
    expect(find.text('Reminders'), findsOneWidget);
    expect(find.text('Support'), findsOneWidget);

    // 5. Save Button
    expect(find.text('Save preferences'), findsOneWidget);
  });

  testWidgets('NotificationsSettingsScreen expands topic and allows toggling channel',
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
        home: const NotificationsSettingsScreen(autoFetch: false),
      ),
    );
    await tester.pumpAndSettle();

    // Tap Bookings topic to expand its channels
    await tester.tap(find.text('Bookings'));
    await tester.pumpAndSettle();

    // Verify channel switches appear
    expect(find.text('Push'), findsOneWidget);
    expect(find.text('SMS'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('In-app'), findsOneWidget);

    // Tap Push switch
    final switches = find.byType(Switch);
    expect(switches, findsNWidgets(4));
    await tester.tap(switches.first);
    await tester.pumpAndSettle();
  });

  testWidgets('NotificationsSettingsScreen opens inbox bottom sheet',
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
        home: const NotificationsSettingsScreen(autoFetch: false),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Open →'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        "You're all caught up! Booking updates, receipts and promotional offers will appear here.",
      ),
      findsOneWidget,
    );
    expect(find.text('Close Inbox'), findsOneWidget);

    await tester.tap(find.text('Close Inbox'));
    await tester.pumpAndSettle();
  });
}

