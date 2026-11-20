import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/screens/profile/change_password_screen.dart';

void main() {
  testWidgets('ChangePasswordScreen renders all elements from web screenshot',
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
        home: const ChangePasswordScreen(
          autoSubmit: false,
          initialEmail: 'test@homecarex.com',
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Verify Top App Bar
    expect(find.text('Change password'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Verify Subtitle Description
    expect(
      find.text("Use a strong password you don't use anywhere else."),
      findsOneWidget,
    );

    // 3. Verify Field Labels
    expect(find.text('CURRENT PASSWORD'), findsOneWidget);
    expect(find.text('NEW PASSWORD'), findsOneWidget);
    expect(find.text('CONFIRM NEW PASSWORD'), findsOneWidget);

    // 4. Verify Forgot Password link
    expect(find.text('Forgot your password?'), findsOneWidget);

    // 5. Verify Password Criteria Checklist items
    expect(find.text('At least 8 characters'), findsOneWidget);
    expect(find.text('An uppercase letter'), findsOneWidget);
    expect(find.text('A number'), findsOneWidget);
    expect(find.text('A special character'), findsOneWidget);

    // Initial state: 4 close icons (unmet)
    expect(find.byIcon(Icons.close_rounded), findsNWidgets(4));
    expect(find.byIcon(Icons.check_rounded), findsNothing);

    // 6. Verify Update Password button
    expect(find.text('Update password'), findsOneWidget);
  });

  testWidgets('ChangePasswordScreen updates criteria checklist dynamically',
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
        home: const ChangePasswordScreen(autoSubmit: false),
      ),
    );
    await tester.pumpAndSettle();

    // Enter a password with uppercase, number, special char, length >= 8: "Admin@123"
    final textFields = find.byType(TextField);
    expect(textFields, findsNWidgets(3));

    // textFields: 0: current, 1: new, 2: confirm
    await tester.enterText(textFields.at(1), 'Admin@123');
    await tester.pumpAndSettle();

    // Now all 4 rules should be met (4 check icons, 0 close icons)
    expect(find.byIcon(Icons.check_rounded), findsNWidgets(4));
    expect(find.byIcon(Icons.close_rounded), findsNothing);
  });

  testWidgets('ChangePasswordScreen shows validation error on mismatch',
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
        home: const ChangePasswordScreen(autoSubmit: false),
      ),
    );
    await tester.pumpAndSettle();

    final textFields = find.byType(TextField);
    await tester.enterText(textFields.at(0), 'OldPassword@1');
    await tester.enterText(textFields.at(1), 'NewPassword@2');
    await tester.enterText(textFields.at(2), 'DifferentPassword@3');
    await tester.pumpAndSettle();

    await tester.tap(find.text('Update password'));
    await tester.pumpAndSettle();

    expect(
      find.text('New password and confirmation do not match.'),
      findsOneWidget,
    );
  });

  testWidgets('ChangePasswordScreen opens forgot password modal sheet',
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
        home: const ChangePasswordScreen(
          autoSubmit: false,
          initialEmail: 'tatukulaedukondalu@gmail.com',
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Forgot your password?'));
    await tester.pumpAndSettle();

    // Modal sheet should appear
    expect(find.text('Forgot Password'), findsOneWidget);
    expect(find.text('Send Reset Link'), findsOneWidget);
  });
}

