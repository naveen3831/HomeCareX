import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:homecarex_mobile/core/models/address_model.dart';
import 'package:homecarex_mobile/screens/profile/saved_addresses_screen.dart';

void main() {
  testWidgets('SavedAddressesScreen displays empty state matching web screenshot',
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
        home: const SavedAddressesScreen(
          autoFetch: false,
          initialAddresses: [],
        ),
      ),
    );
    await tester.pumpAndSettle();

    // 1. Top Bar
    expect(find.text('Saved addresses'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);

    // 2. Subtitle Header
    expect(
      find.text(
        'Choose where we should come. Your selected address shows on the dashboard.',
      ),
      findsOneWidget,
    );

    // 3. Empty State Card
    expect(find.byIcon(Icons.location_on_outlined), findsOneWidget);
    expect(find.text('No saved addresses yet'), findsOneWidget);
    expect(
      find.text(
        'Add where you\'d like services delivered. You can save Home, Work and more.',
      ),
      findsOneWidget,
    );
    expect(find.text('Add your first address'), findsOneWidget);
  });

  testWidgets('SavedAddressesScreen opens address form modal sheet',
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
        home: const SavedAddressesScreen(
          autoFetch: false,
          initialAddresses: [],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add your first address'));
    await tester.pumpAndSettle();

    // Form elements in modal bottom sheet
    expect(find.text('Add New Address'), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Work'), findsOneWidget);
    expect(find.text('Other'), findsOneWidget);
    expect(find.text('Save Address'), findsOneWidget);
  });

  testWidgets('SavedAddressesScreen displays address cards when addresses exist',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final testAddresses = [
      CustomerAddress(
        id: 'addr-1',
        label: 'Home',
        house: 'Flat 402, Green Glen Apartments',
        street: '100 Feet Road',
        area: 'Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        isDefault: true,
      ),
      CustomerAddress(
        id: 'addr-2',
        label: 'Work',
        house: 'Tower B, 3rd Floor',
        street: 'Tech Park',
        area: 'Whitefield',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560066',
        isDefault: false,
      ),
    ];

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: InkRipple.splashFactory,
        ),
        home: SavedAddressesScreen(
          autoFetch: false,
          initialAddresses: testAddresses,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify top banner
    expect(find.text('Add new address'), findsOneWidget);
    expect(find.text('Home, work or anywhere we should reach you'), findsOneWidget);

    // Verify cards
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Selected'), findsOneWidget);
    expect(find.text('Work'), findsOneWidget);
    expect(find.text('Deliver here'), findsOneWidget);
  });
}

