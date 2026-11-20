import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/screens/reviews/reviews_screen.dart';

void main() {
  testWidgets('ReviewsScreen displays all elements matching web screenshot',
      (WidgetTester tester) async {
    // Provide adequate surface size to avoid layout clipping during test
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          splashFactory: InkRipple.splashFactory,
        ),
        home: const ReviewsScreen(autoFetch: false),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Verify Top Bar
    expect(find.text('Reviews'), findsWidgets);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Verify Header subtitle description
    expect(
      find.text(
        'Rate your completed services. Your review is published on the service page right away, and our team may remove anything that breaks our guidelines.',
      ),
      findsOneWidget,
    );

    // 3. Verify Segmented tabs
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('My reviews'), findsOneWidget);

    // 4. Verify Pending empty state card
    expect(find.text("You're all caught up"), findsOneWidget);
    expect(
      find.text('When a service is completed, you can rate it here.'),
      findsOneWidget,
    );
    expect(find.text('View my bookings'), findsOneWidget);
    expect(find.byIcon(Icons.star_outline_rounded), findsOneWidget);

    // 5. Tap on 'My reviews' tab
    await tester.tap(find.text('My reviews'));
    await tester.pumpAndSettle();

    // 6. Verify My reviews empty state card
    expect(find.text('No reviews yet'), findsOneWidget);
    expect(
      find.text(
        'Reviews you write will show up here with their validation status.',
      ),
      findsOneWidget,
    );
    expect(find.text('See pending reviews'), findsOneWidget);
    expect(find.byIcon(Icons.chat_bubble_outline_rounded), findsOneWidget);

    // 7. Tap 'See pending reviews' action button to switch back
    await tester.tap(find.text('See pending reviews'));
    await tester.pumpAndSettle();

    expect(find.text("You're all caught up"), findsOneWidget);
  });
}

