import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/core/models/address_model.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/providers/notification_provider.dart';
import 'package:homecarex_mobile/providers/address_provider.dart';
import 'package:homecarex_mobile/screens/home/home_screen.dart';
import 'package:homecarex_mobile/screens/profile/saved_addresses_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
  });

  group('AddressProvider tests', () {
    test('Initializes with default seed address', () {
      final provider = AddressProvider()..syncRemote = false;

      expect(provider.addresses.length, 1);
      final current = provider.selectedAddress;
      expect(current, isNotNull);
      expect(current!.label, 'Home');
      expect(
        current.fullAddressLine,
        '000000, Image Garden Road, Ayyappa Society Colony, Hyderabad, 500081',
      );
    });

    test('selectAddress switches the active default address', () async {
      final provider = AddressProvider()..syncRemote = false;

      final office = CustomerAddress(
        id: 'office-1',
        label: 'Office',
        house: 'Suite 404',
        street: 'Cyber Towers',
        area: 'Hitec City',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        isDefault: false,
      );
      await provider.addAddress(office);

      expect(provider.addresses.length, 2);
      await provider.selectAddress('office-1');

      expect(provider.selectedAddress?.id, 'office-1');
      expect(provider.selectedAddress?.label, 'Office');
    });
  });

  group('HomeScreen Location Picker Dropdown tests', () {
    Widget buildHomeScreen({
      required AddressProvider addressProvider,
    }) {
      final bookingProvider = BookingProvider()..syncRemote = false;
      final notifProvider = NotificationProvider()..syncRemote = false;

      return MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => CartProvider()),
          ChangeNotifierProvider(create: (_) => CatalogProvider()),
          ChangeNotifierProvider.value(value: bookingProvider),
          ChangeNotifierProvider.value(value: notifProvider),
          ChangeNotifierProvider.value(value: addressProvider),
        ],
        child: const MaterialApp(
          home: HomeScreen(),
        ),
      );
    }

    testWidgets('Tapping location in header toggles city picker dropdown with available cities', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final addressProvider = AddressProvider()..syncRemote = false;

      await tester.pumpWidget(buildHomeScreen(addressProvider: addressProvider));
      await tester.pump();

      // Verify initial header shows Hyderabad and down arrow
      expect(find.text('Hyderabad'), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_down_rounded), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsNothing);

      // Verify dropdown is not open yet
      expect(find.text('Select Service City'), findsNothing);

      // Tap location picker pill
      await tester.tap(find.text('Hyderabad'));
      await tester.pump();

      // Verify chevron flips to up
      expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_down_rounded), findsNothing);

      // Verify dropdown card is open with Select Service City and cities list
      expect(find.text('Select Service City'), findsOneWidget);
      expect(find.text('Bengaluru'), findsOneWidget);
      expect(find.text('Mumbai'), findsOneWidget);

      // Tapping on Bengaluru selects it and closes the dropdown
      await tester.tap(find.text('Bengaluru'));
      await tester.pump();

      // Dropdown is closed, chevron flips back to down, header updated to Bengaluru
      expect(find.text('Select Service City'), findsNothing);
      expect(find.text('Bengaluru'), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_down_rounded), findsOneWidget);
    });
  });
}
