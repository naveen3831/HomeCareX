import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/screens/profile/edit_profile_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });
  testWidgets('EditProfileScreen displays all elements matching web screenshot',
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
          home: const EditProfileScreen(
            initialName: 'TATUKULA EDUKONDALU',
            initialEmail: 'tatukulaedukondalu@gmail.com',
            initialPhone: '8346167714',
            autoSubmit: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Top Bar
    expect(find.text('Edit profile'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Subtitle
    expect(
      find.text('Update your photo, name, email and phone.'),
      findsOneWidget,
    );

    // 3. Profile photo section
    expect(find.text('Profile photo'), findsOneWidget);
    expect(find.text('JPG, PNG or WebP, up to 2 MB.'), findsOneWidget);
    expect(find.text('Add photo'), findsOneWidget);
    expect(find.text('TE'), findsOneWidget);

    // 4. Form Labels
    expect(find.text('FULL NAME'), findsOneWidget);
    expect(find.text('EMAIL'), findsOneWidget);
    expect(find.text('PHONE (optional)'), findsOneWidget);
    expect(
      find.text('10-digit mobile number. Leave blank to remove it.'),
      findsOneWidget,
    );

    // 5. Pre-filled Values
    expect(find.text('TATUKULA EDUKONDALU'), findsOneWidget);
    expect(find.text('tatukulaedukondalu@gmail.com'), findsOneWidget);
    expect(find.text('8346167714'), findsOneWidget);

    // 6. Action Buttons
    expect(find.text('Save changes'), findsOneWidget);
    expect(find.text('Reset'), findsOneWidget);
  });

  testWidgets('EditProfileScreen Reset button restores initial values',
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
          home: const EditProfileScreen(
            initialName: 'TATUKULA EDUKONDALU',
            initialEmail: 'tatukulaedukondalu@gmail.com',
            initialPhone: '8346167714',
            autoSubmit: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Edit the name field
    final textFields = find.byType(TextField);
    expect(textFields, findsNWidgets(3));

    await tester.enterText(textFields.at(0), 'NEW EDITED NAME');
    await tester.pumpAndSettle();
    expect(find.text('NEW EDITED NAME'), findsOneWidget);

    // Tap Reset
    await tester.tap(find.text('Reset'));
    await tester.pumpAndSettle();

    expect(find.text('TATUKULA EDUKONDALU'), findsOneWidget);
    expect(find.text('NEW EDITED NAME'), findsNothing);
  });

  testWidgets('EditProfileScreen opens photo options modal sheet',
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
          home: const EditProfileScreen(
            initialName: 'TATUKULA EDUKONDALU',
            initialEmail: 'tatukulaedukondalu@gmail.com',
            initialPhone: '8346167714',
            autoSubmit: false,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add photo'));
    await tester.pumpAndSettle();

    expect(find.text('Change Profile Photo'), findsOneWidget);
    expect(find.text('Take Photo'), findsOneWidget);
    expect(find.text('Choose from Gallery'), findsOneWidget);
  });

  testWidgets('EditProfileScreen Save changes saves and updates successfully',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final authProvider = AuthProvider();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: authProvider),
        ],
        child: MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: InkRipple.splashFactory,
          ),
          home: const EditProfileScreen(
            initialName: 'TATUKULA EDUKONDALU',
            initialEmail: 'tatukulaedukondalu@gmail.com',
            initialPhone: '8346167714',
            autoSubmit: true,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final textFields = find.byType(TextField);
    await tester.enterText(textFields.at(0), 'TATUKULA UPDATED');
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Save changes'));
    await tester.tap(find.text('Save changes'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 4));
    await tester.pump(const Duration(milliseconds: 500));

    expect(authProvider.user?.name, 'TATUKULA UPDATED');
  });
}
