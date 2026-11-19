import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/screens/support/create_ticket_screen.dart';

void main() {
  testWidgets('CreateTicketScreen displays all fields matching web screenshot',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: CreateTicketScreen(),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Verify Top Bar
    expect(find.text('Contact Us'), findsOneWidget);

    // 2. Verify Title and Subtitle
    expect(find.text('Create a support ticket'), findsOneWidget);
    expect(
      find.text('Tell us what happened. Your conversation stays private.'),
      findsOneWidget,
    );

    // 3. Verify Category Section
    expect(find.text('Category'), findsOneWidget);
    expect(find.text('Booking'), findsNWidgets(2)); // Category value & Related booking label

    // 4. Verify Priority Section
    expect(find.text('Priority'), findsOneWidget);
    expect(find.text('Normal'), findsOneWidget);

    // 5. Verify Related booking Section
    expect(find.text('Find a booking'), findsOneWidget);
    expect(
      find.text('Search by service or booking reference'),
      findsOneWidget,
    );
    expect(find.text('Booking'), findsNWidgets(2));
    expect(find.text('General question / no booking'), findsOneWidget);
    expect(
      find.text('No matching bookings. You can still raise a general question.').evaluate().isNotEmpty ||
          find.text('Loading your bookings…').evaluate().isNotEmpty,
      isTrue,
    );

    // 6. Verify Subject & Description
    expect(find.text('Subject'), findsOneWidget);
    expect(find.text('A short summary of your issue'), findsOneWidget);
    expect(find.text('Description'), findsOneWidget);
    expect(
      find.text('Describe what happened and how we can help.'),
      findsOneWidget,
    );
    expect(
      find.text('0/4000 characters. Do not include passwords or payment PINs.'),
      findsOneWidget,
    );

    // 7. Verify Attachments & Submit button
    expect(find.text('Add photos or documents'), findsOneWidget);
    expect(find.text('Up to 3 images or PDFs. Maximum 5 MB each.'), findsOneWidget);
    expect(find.text('Submit Ticket'), findsOneWidget);
  });
}
