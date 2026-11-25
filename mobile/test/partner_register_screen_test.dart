import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/core/services/api_service.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/screens/auth/login_screen.dart';
import 'package:homecarex_mobile/screens/auth/partner_register_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
    ApiService.resetActiveBaseUrl();
  });

  Widget buildTestScreen(AuthProvider auth) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
      ],
      child: MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: NoSplash.splashFactory,
        ),
        home: const PartnerRegisterScreen(),
      ),
    );
  }

  testWidgets('PartnerRegisterScreen renders Step 1 with matching UI elements', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final auth = AuthProvider();
    await tester.pumpWidget(buildTestScreen(auth));
    await tester.pumpAndSettle();

    // Verify top bar and header
    expect(find.text('Back to Home'), findsOneWidget);
    expect(find.text('Partner Registration'), findsOneWidget);
    expect(find.text('Become a HomeCareX Partner'), findsOneWidget);
    expect(find.text('Register your business and start receiving service bookings.'), findsOneWidget);

    // Verify Step 1 section title & fields
    expect(find.text('Section A: Personal Information'), findsOneWidget);
    expect(find.text('Basic profile information for your partner identity'), findsOneWidget);
    expect(find.text('Step 1 of 5'), findsWidgets);

    expect(find.text('Full Name'), findsOneWidget);
    expect(find.text('Date of Birth'), findsOneWidget);
    expect(find.text('Gender'), findsOneWidget);
    expect(find.text('Mobile Number'), findsOneWidget);
    expect(find.text('Email Address'), findsOneWidget);
    expect(find.text('Create Password'), findsOneWidget);
    expect(find.text('Confirm Password'), findsOneWidget);

    expect(find.text('Continue to Step 2 →'), findsOneWidget);
  });

  testWidgets('PartnerRegisterScreen validates required fields on Step 1', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final auth = AuthProvider();
    await tester.pumpWidget(buildTestScreen(auth));
    await tester.pumpAndSettle();

    // Tap Continue without filling anything
    await tester.tap(find.text('Continue to Step 2 →'));
    await tester.pumpAndSettle();

    expect(find.text('Please enter your full name'), findsOneWidget);
  });

  testWidgets('PartnerRegisterScreen advances to Step 2 and allows going back', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final auth = AuthProvider();
    await tester.pumpWidget(buildTestScreen(auth));
    await tester.pumpAndSettle();

    // Fill valid Step 1 data
    final textFields = find.byType(TextFormField);
    // 0: Full Name, 1: DOB, 2: Mobile Number, 3: Email, 4: Password, 5: Confirm Password
    await tester.enterText(textFields.at(0), 'Ramesh Kumar');
    await tester.enterText(textFields.at(1), '15-08-1992');

    // Select Gender
    await tester.tap(find.text('Select Gender'), warnIfMissed: false);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Male').last, warnIfMissed: false);
    await tester.pumpAndSettle();

    await tester.enterText(textFields.at(2), '9876543210');
    await tester.enterText(textFields.at(3), 'ramesh@example.com');
    await tester.enterText(textFields.at(4), 'Secret@123');
    await tester.enterText(textFields.at(5), 'Secret@123');

    // Tap Continue to Step 2
    await tester.tap(find.text('Continue to Step 2 →'));
    await tester.pumpAndSettle();

    // Verify Step 2 rendered
    expect(find.text('Section B: Identity Proof'), findsOneWidget);
    expect(find.text('Step 2 of 5'), findsWidgets);
    expect(find.text('Upload ID Document (Optional)'), findsOneWidget);
    expect(find.text('Tap to select document (PDF, PNG, JPG)'), findsOneWidget);
    expect(find.text('Maximum size: 5MB'), findsOneWidget);

    // Tap upload document box to select document files
    await tester.tap(find.text('Tap to select document (PDF, PNG, JPG)'));
    await tester.pumpAndSettle();

    // Verify document file is loaded and remove icon is available
    expect(find.text('id_document.pdf'), findsOneWidget);
    expect(find.byIcon(Icons.close_rounded), findsOneWidget);

    // Tap remove icon to clear file
    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();
    expect(find.text('Tap to select document (PDF, PNG, JPG)'), findsOneWidget);

    expect(find.text('← Back'), findsOneWidget);

    // Tap Back
    await tester.tap(find.text('← Back'));
    await tester.pumpAndSettle();

    // Verify back on Step 1
    expect(find.text('Section A: Personal Information'), findsOneWidget);
    expect(find.text('Continue to Step 2 →'), findsOneWidget);
  });

  testWidgets('PartnerRegisterScreen renders "Already registered as a partner? Sign in here" and navigates to LoginScreen', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final auth = AuthProvider();
    await tester.pumpWidget(buildTestScreen(auth));
    await tester.pumpAndSettle();

    // Verify text
    expect(find.text('Already registered as a partner? '), findsOneWidget);
    expect(find.text('Sign in here'), findsOneWidget);

    // Also verify trust badges
    expect(find.text('Verified Platform'), findsOneWidget);
    expect(find.text('Fast Payouts'), findsOneWidget);
    expect(find.text('Instant Bookings'), findsOneWidget);

    // Tap Sign in here
    await tester.tap(find.text('Sign in here'));
    await tester.pumpAndSettle();

    // Verify LoginScreen is shown
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('Sign in to manage your home care and book services'), findsOneWidget);
  });
}
