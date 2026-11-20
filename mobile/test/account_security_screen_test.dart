import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/screens/profile/account_security_screen.dart';
import 'package:homecarex_mobile/screens/profile/change_password_screen.dart';

void main() {
  testWidgets('AccountSecurityScreen displays all cards matching web screenshot',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const AccountSecurityScreen(
            userEmail: 'tatukulaedukondalu@gmail.com',
            autoFetch: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Top Navigation Bar
    expect(find.text('Account Security'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Card 0: Hero Status Card
    expect(find.byType(RichText), findsWidgets);
    expect(
      find.text(
        'Manage your password, review active login sessions, and protect your account.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Signed in as'), findsOneWidget);

    // 3. Card 1: Change Password Card
    expect(find.text('Change Password'), findsWidgets);
    expect(
      find.text('Verify your current password to set a new one.'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.vpn_key_rounded), findsOneWidget);

    // 4. Card 2: Active Sessions Card
    expect(find.text('Active Sessions'), findsOneWidget);
    expect(
      find.text('Devices currently authenticated with your account.'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.devices_rounded), findsOneWidget);

    // 5. Card 3: Log Out of All Devices Card
    expect(find.text('Log Out of All Devices'), findsWidgets);
    expect(
      find.text(
        'Terminate all active sessions across every device, including phone, computer, and browser immediately.',
      ),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.logout_rounded), findsWidgets);
  });

  testWidgets('AccountSecurityScreen expands active sessions and shows devices',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const AccountSecurityScreen(
            userEmail: 'tatukulaedukondalu@gmail.com',
            autoFetch: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Tap Active Sessions card to expand
    await tester.tap(find.text('Active Sessions'));
    await tester.pumpAndSettle();

    // Verify session items are visible
    expect(find.text('HomeCareX Mobile · Mobile App'), findsOneWidget);
    expect(find.text('This device'), findsOneWidget);
    expect(find.text('Windows Desktop · Chrome 131'), findsOneWidget);
  });

  testWidgets('AccountSecurityScreen Change Password button navigates to ChangePasswordScreen',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const AccountSecurityScreen(
            userEmail: 'tatukulaedukondalu@gmail.com',
            autoFetch: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Tap Change Password button
    final buttonFinder = find.widgetWithText(ElevatedButton, 'Change Password');
    expect(buttonFinder, findsOneWidget);
    await tester.tap(buttonFinder);
    await tester.pumpAndSettle();

    // Verify ChangePasswordScreen opened
    expect(find.byType(ChangePasswordScreen), findsOneWidget);
    expect(find.text('CURRENT PASSWORD'), findsOneWidget);
    expect(find.text('NEW PASSWORD'), findsOneWidget);
  });

  testWidgets('AccountSecurityScreen shows confirmation dialog for Log Out of All Devices',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const AccountSecurityScreen(
            userEmail: 'tatukulaedukondalu@gmail.com',
            autoFetch: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Scroll down to make button visible
    await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -300));
    await tester.pumpAndSettle();

    final logoutAllBtn = find.widgetWithText(ElevatedButton, 'Log Out of All Devices');
    expect(logoutAllBtn, findsOneWidget);
    await tester.tap(logoutAllBtn);
    await tester.pumpAndSettle();

    // Dialog should appear
    expect(find.text('Log out of all devices?'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
    expect(find.text('Log Out All'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(find.text('Log out of all devices?'), findsNothing);
  });
}
