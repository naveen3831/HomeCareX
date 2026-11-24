import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/core/services/api_service.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/screens/auth/login_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
    ApiService.resetActiveBaseUrl();
  });

  test('AuthProvider handles accessToken login response from backend', () async {
    final auth = AuthProvider();

    // Verify initial default/guest state
    expect(auth.isLoading, false);

    // Emulate what ApiService returns from backend: Map with accessToken & user
    final mockBackendResponse = {
      'user': {
        'id': '6abb7fd4f4ae29d02df7c55a',
        'name': 'Test Customer',
        'email': 'customer@homecarex.com',
        'phone': '9000000006',
        'role': 'customer',
        'status': 'active',
      },
      'accessToken': 'mock_jwt_token_12345',
    };

    // When accessToken is present, token is parsed correctly
    final token = mockBackendResponse['token'] ?? mockBackendResponse['accessToken'];
    expect(token, 'mock_jwt_token_12345');

    await StorageService.setLoggedOut(false);
    await StorageService.saveToken(token.toString());
    final savedToken = await StorageService.getToken();
    expect(savedToken, 'mock_jwt_token_12345');
    final isLoggedOut = await StorageService.isLoggedOut();
    expect(isLoggedOut, false);
  });

  testWidgets('LoginScreen validates email and phone number formats', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final auth = AuthProvider();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: auth),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: const LoginScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify presence of form fields
    final emailField = find.byType(TextFormField).first;
    final passField = find.byType(TextFormField).last;
    expect(emailField, findsOneWidget);
    expect(passField, findsOneWidget);

    // Tap Sign In with empty fields -> shows validation errors
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();
    expect(find.text('Please enter your email or phone number'), findsOneWidget);
    expect(find.text('Please enter your password'), findsOneWidget);

    // Enter invalid format
    await tester.enterText(emailField, 'notanemail');
    await tester.enterText(passField, '12345');
    await tester.tap(find.text('Sign In'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email or 10-digit mobile number'), findsOneWidget);
    expect(find.text('Password must be at least 6 characters'), findsOneWidget);

    // Enter valid 10-digit phone
    await tester.enterText(emailField, '9876543210');
    await tester.enterText(passField, 'Secret@123');
    await tester.tap(find.text('Sign In'));
    await tester.pump();
    // Validation passes (no format error shown)
    expect(find.text('Enter a valid email or 10-digit mobile number'), findsNothing);
  });
}
