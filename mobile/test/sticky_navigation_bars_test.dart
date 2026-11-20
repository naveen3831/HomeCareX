import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/screens/home/home_screen.dart';
import 'package:homecarex_mobile/screens/catalog/categories_screen.dart';
import 'package:homecarex_mobile/screens/catalog/services_screen.dart';
import 'package:homecarex_mobile/screens/bookings/bookings_screen.dart';
import 'package:homecarex_mobile/screens/profile/profile_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget createTestWidget(Widget child) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider(create: (_) => BookingProvider()),
      ],
      child: MaterialApp(
        home: child,
      ),
    );
  }

  testWidgets('HomeScreen has sticky top location bar outside SingleChildScrollView', (tester) async {
    await tester.pumpWidget(createTestWidget(const HomeScreen()));
    await tester.pump();

    // Verify 'Deliver to ' and '• Add address' exist
    expect(find.text('Deliver to '), findsOneWidget);
    expect(find.text('• Add address'), findsOneWidget);

    // Verify it is not a descendant of SingleChildScrollView
    final scrollView = find.byType(SingleChildScrollView);
    expect(
      find.descendant(of: scrollView, matching: find.text('Deliver to ')),
      findsNothing,
    );
  });

  testWidgets('CategoriesScreen has sticky top bar outside SingleChildScrollView', (tester) async {
    await tester.pumpWidget(createTestWidget(const CategoriesScreen()));
    await tester.pump();

    expect(find.text('Categories'), findsOneWidget);

    final scrollView = find.byType(SingleChildScrollView);
    expect(
      find.descendant(of: scrollView, matching: find.text('Categories')),
      findsNothing,
    );
  });

  testWidgets('ServicesScreen has sticky top bar outside SingleChildScrollView', (tester) async {
    await tester.pumpWidget(createTestWidget(const ServicesScreen()));
    await tester.pump();

    expect(find.text('Services'), findsOneWidget);

    final scrollView = find.byType(SingleChildScrollView);
    expect(
      find.descendant(of: scrollView, matching: find.text('Services')),
      findsNothing,
    );
  });

  testWidgets('BookingsScreen has sticky top bar outside SingleChildScrollView', (tester) async {
    await tester.pumpWidget(createTestWidget(const BookingsScreen()));
    await tester.pump();

    expect(find.text('My Bookings'), findsOneWidget);

    final scrollView = find.byType(SingleChildScrollView);
    expect(
      find.descendant(of: scrollView, matching: find.text('My Bookings')),
      findsNothing,
    );
  });

  testWidgets('ProfileScreen has sticky top bar outside ListView', (tester) async {
    await tester.pumpWidget(createTestWidget(const ProfileScreen()));
    await tester.pump();

    expect(find.text('Profile'), findsOneWidget);

    final listView = find.byType(ListView);
    expect(
      find.descendant(of: listView, matching: find.text('Profile')),
      findsNothing,
    );
  });
}
