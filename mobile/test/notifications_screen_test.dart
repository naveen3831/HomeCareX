import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:homecarex_mobile/core/models/notification_model.dart';
import 'package:homecarex_mobile/core/utils/bell_3d_icon.dart';
import 'package:homecarex_mobile/providers/auth_provider.dart';
import 'package:homecarex_mobile/providers/booking_provider.dart';
import 'package:homecarex_mobile/providers/cart_provider.dart';
import 'package:homecarex_mobile/core/services/storage_service.dart';
import 'package:homecarex_mobile/providers/catalog_provider.dart';
import 'package:homecarex_mobile/providers/notification_provider.dart';
import 'package:homecarex_mobile/screens/home/home_screen.dart';
import 'package:homecarex_mobile/screens/notifications/notifications_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    StorageService.clearCache();
  });

  group('NotificationModel tests', () {
    test('NotificationModel serializes and deserializes correctly', () {
      final now = DateTime.now();
      final model = NotificationModel(
        id: 'test-1',
        type: 'payment.succeeded',
        group: 'payment',
        title: 'Payment successful',
        message: 'Payment received. Your booking is confirmed',
        createdAt: now,
      );

      final json = model.toJson();
      final fromJson = NotificationModel.fromJson(json);

      expect(fromJson.id, 'test-1');
      expect(fromJson.type, 'payment.succeeded');
      expect(fromJson.group, 'payment');
      expect(fromJson.title, 'Payment successful');
      expect(fromJson.message, 'Payment received. Your booking is confirmed');
      expect(fromJson.isUnread, isTrue);
      expect(fromJson.isRead, isFalse);
    });

    test('NotificationModel timeAgo and dayBucket calculation', () {
      final now = DateTime.now();
      final justNow = NotificationModel(
        id: '1',
        type: 'test',
        group: 'system',
        title: 'T',
        message: 'M',
        createdAt: now.subtract(const Duration(seconds: 10)),
      );
      expect(justNow.timeAgo, 'Just now');
      expect(justNow.dayBucket, 'TODAY');

      final minutesAgo = NotificationModel(
        id: '2',
        type: 'test',
        group: 'system',
        title: 'T',
        message: 'M',
        createdAt: now.subtract(const Duration(minutes: 29)),
      );
      expect(minutesAgo.timeAgo, '29 min ago');

      final hoursAgo = NotificationModel(
        id: '3',
        type: 'test',
        group: 'system',
        title: 'T',
        message: 'M',
        createdAt: now.subtract(const Duration(hours: 1)),
      );
      expect(hoursAgo.timeAgo, '1 h ago');
    });

    test('resolveGroup and describeType fallback', () {
      expect(NotificationModel.resolveGroup('booking.created'), 'booking');
      expect(NotificationModel.resolveGroup('payment.succeeded'), 'payment');
      expect(NotificationModel.resolveGroup('support.ticket'), 'support');
      expect(NotificationModel.resolveGroup('custom.unknown'), 'system');

      final desc = NotificationModel.describeType('booking.assigned');
      expect(desc['title'], 'Partner assigned');
      expect(desc['message'], 'A partner has been assigned to your booking.');
    });
  });

  group('NotificationProvider tests', () {
    test('Initializes with default seed notifications', () {
      final provider = NotificationProvider()..syncRemote = false;

      expect(provider.notifications.length, 2);
      expect(provider.unreadCount, 2);
      expect(provider.countForGroup('all'), 2);
      expect(provider.countForGroup('booking'), 1);
      expect(provider.countForGroup('payment'), 1);
      expect(provider.countForGroup('partner'), 0);
    });

    test('Group filtering works correctly', () {
      final provider = NotificationProvider()..syncRemote = false;

      provider.selectGroup('booking');
      expect(provider.filteredNotifications.length, 1);
      expect(provider.filteredNotifications.first.group, 'booking');

      provider.selectGroup('payment');
      expect(provider.filteredNotifications.length, 1);
      expect(provider.filteredNotifications.first.group, 'payment');

      provider.selectGroup('all');
      expect(provider.filteredNotifications.length, 2);
    });

    test('markAsRead and markAllRead update unread counts', () async {
      final provider = NotificationProvider()..syncRemote = false;

      final firstId = provider.notifications.first.id;
      await provider.markAsRead(firstId);

      expect(provider.unreadCount, 1);
      expect(provider.notifications.firstWhere((n) => n.id == firstId).isRead, isTrue);

      await provider.markAllRead();
      expect(provider.unreadCount, 0);
    });

    test('deleteNotification and deleteAll remove items', () async {
      final provider = NotificationProvider()..syncRemote = false;

      final firstId = provider.notifications.first.id;
      await provider.deleteNotification(firstId);
      expect(provider.notifications.length, 1);

      await provider.deleteAll();
      expect(provider.notifications.isEmpty, isTrue);
      expect(provider.unreadCount, 0);
    });
  });

  group('NotificationsScreen Widget tests', () {
    Widget buildTestScreen(NotificationProvider provider) {
      return MaterialApp(
        home: ChangeNotifierProvider<NotificationProvider>.value(
          value: provider,
          child: const NotificationsScreen(),
        ),
      );
    }

    testWidgets('renders all screen components matching reference screenshot', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final provider = NotificationProvider()..syncRemote = false;

      await tester.pumpWidget(buildTestScreen(provider));
      await tester.pump();

      // Header
      expect(find.text('Notifications'), findsOneWidget);

      // Sub-header
      expect(find.text('2 unread'), findsOneWidget);
      expect(find.text('Mark all read'), findsOneWidget);

      // Filter tabs
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Booking'), findsOneWidget);
      expect(find.text('Payment'), findsOneWidget);
      expect(find.text('Partner'), findsOneWidget);

      // Section
      expect(find.text('TODAY'), findsOneWidget);

      // Items
      expect(find.text('Payment successful'), findsOneWidget);
      expect(find.text('Payment received. Your booking is confirmed'), findsOneWidget);
      expect(find.text('PAYMENT'), findsOneWidget);

      expect(find.text('Partner assigned'), findsOneWidget);
      expect(find.text('A partner has been assigned to your booking'), findsOneWidget);
      expect(find.text('BOOKING'), findsOneWidget);

      // "Mark as read" buttons
      expect(find.text('Mark as read'), findsNWidgets(2));
    });

    testWidgets('Filter by category tab filters the displayed list', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final provider = NotificationProvider()..syncRemote = false;

      await tester.pumpWidget(buildTestScreen(provider));
      await tester.pump();

      // Tap "Booking" tab
      await tester.tap(find.text('Booking'));
      await tester.pump();

      expect(find.text('Partner assigned'), findsOneWidget);
      expect(find.text('Payment successful'), findsNothing);

      // Tap "Payment" tab
      await tester.tap(find.text('Payment'));
      await tester.pump();

      expect(find.text('Payment successful'), findsOneWidget);
      expect(find.text('Partner assigned'), findsNothing);
    });

    testWidgets('Tapping Mark all read marks all notifications as read', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final provider = NotificationProvider()..syncRemote = false;

      await tester.pumpWidget(buildTestScreen(provider));
      await tester.pump();

      expect(find.text('2 unread'), findsOneWidget);

      await tester.tap(find.text('Mark all read'));
      await tester.pump();

      expect(find.text("You're all caught up"), findsOneWidget);
      expect(find.text('Mark as read'), findsNothing);
    });

    testWidgets('Tapping Trash opens confirmation dialog and deletes all', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final provider = NotificationProvider()..syncRemote = false;

      await tester.pumpWidget(buildTestScreen(provider));
      await tester.pump();

      // Tap trash icon button
      await tester.tap(find.byIcon(Icons.delete_outline_rounded));
      await tester.pump();

      expect(find.text('Delete all notifications?'), findsOneWidget);
      expect(find.text('Yes, delete all'), findsOneWidget);

      // Confirm delete
      await tester.tap(find.text('Yes, delete all'));
      await tester.pump();

      expect(find.text('No notifications yet'), findsOneWidget);
    });
  });

  group('HomeScreen 3D Bell Icon and Navigation test', () {
    testWidgets('HomeScreen displays 3D clay bell with badge and navigates to NotificationsScreen', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final bookingProvider = BookingProvider();
      bookingProvider.syncRemote = false;
      final notifProvider = NotificationProvider()..syncRemote = false;

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => CartProvider()),
            ChangeNotifierProvider(create: (_) => CatalogProvider()),
            ChangeNotifierProvider.value(value: bookingProvider),
            ChangeNotifierProvider.value(value: notifProvider),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );
      await tester.pump();

      // Verify NotificationBellButton and Bell3DIcon are displayed
      expect(find.byType(NotificationBellButton), findsOneWidget);
      expect(find.byType(Bell3DIcon), findsOneWidget);

      // Verify badge count shows 2
      expect(find.text('2'), findsOneWidget);

      // Tap 3D notification bell button
      await tester.tap(find.byType(NotificationBellButton));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      // Verify navigation to NotificationsScreen
      expect(find.byType(NotificationsScreen), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Payment successful'), findsOneWidget);
    });

    testWidgets('HomeScreen bell does not display badge when unread notifications is 0 even if active bookings exist', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final bookingProvider = BookingProvider();
      bookingProvider.syncRemote = false;
      final notifProvider = NotificationProvider()..syncRemote = false;
      // Mark all notifications as read so unreadCount becomes 0
      await notifProvider.markAllRead();
      expect(notifProvider.unreadCount, 0);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => CartProvider()),
            ChangeNotifierProvider(create: (_) => CatalogProvider()),
            ChangeNotifierProvider.value(value: bookingProvider),
            ChangeNotifierProvider.value(value: notifProvider),
          ],
          child: const MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );
      await tester.pump();

      // Verify NotificationBellButton and Bell3DIcon are displayed
      expect(find.byType(NotificationBellButton), findsOneWidget);
      expect(find.byType(Bell3DIcon), findsOneWidget);

      // Verify no badge count is displayed (neither 0, 2, nor active bookings count like 3)
      expect(find.text('0'), findsNothing);
      expect(find.text('2'), findsNothing);
      expect(find.text('3'), findsNothing);

      final bellButton = tester.widget<NotificationBellButton>(find.byType(NotificationBellButton));
      expect(bellButton.count, 0);
    });
  });
}
