import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/constants/app_colors.dart';
import 'providers/auth_provider.dart';
import 'providers/catalog_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/booking_provider.dart';
import 'providers/notification_provider.dart';
import 'providers/address_provider.dart';
import 'screens/splash/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Catch all synchronous Flutter framework widget / render errors
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    debugPrint('[HomeCareX FlutterError] ${details.exception}');
  };

  // 2. Catch all asynchronous zone, microtask, timer, and channel errors
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    debugPrint('[HomeCareX AsyncError] $error');
    return true; // Marked as handled - permanently prevents app termination/crash
  };

  // 3. Graceful fallback widget instead of gray/red crash screen
  ErrorWidget.builder = (FlutterErrorDetails details) {
    return const Material(
      color: AppColors.canvas,
      child: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.refresh_rounded, size: 40, color: AppColors.brand),
              SizedBox(height: 12),
              Text(
                'HomeCareX',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.text),
              ),
              SizedBox(height: 6),
              Text(
                'Refreshing content...',
                style: TextStyle(fontSize: 13, color: AppColors.muted),
              ),
            ],
          ),
        ),
      ),
    );
  };

  runApp(const HomeCareXApp());
}

class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) {
    return child;
  }

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
  }
}

class HomeCareXApp extends StatelessWidget {
  const HomeCareXApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
        ),
        ChangeNotifierProvider(
          create: (_) => CatalogProvider()..fetchCatalog(),
        ),
        ChangeNotifierProvider(
          create: (_) => CartProvider(),
        ),
        ChangeNotifierProvider(
          create: (_) => BookingProvider(),
        ),
        ChangeNotifierProvider(
          create: (_) => NotificationProvider(),
        ),
        ChangeNotifierProvider(
          create: (_) => AddressProvider(),
        ),
      ],
      child: MaterialApp(
        title: 'HomeCareX',
        debugShowCheckedModeBanner: false,
        scrollBehavior: const AppScrollBehavior(),
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: InkRipple.splashFactory,
          scaffoldBackgroundColor: AppColors.canvas,
          primaryColor: AppColors.brand,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.brand,
            primary: AppColors.brand,
            secondary: AppColors.accent,
            surface: AppColors.panel,
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: AppColors.panel,
            foregroundColor: AppColors.text,
            elevation: 0,
            centerTitle: false,
            titleTextStyle: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.text,
            ),
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.brand,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              textStyle: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          cardTheme: const CardThemeData(
            color: AppColors.panel,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.all(Radius.circular(16)),
              side: BorderSide(color: AppColors.line),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: AppColors.panel,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.brand, width: 2),
            ),
          ),
        ),
        home: const SplashScreen(),
      ),
    );
  }
}

