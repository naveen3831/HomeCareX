import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../providers/cart_provider.dart';
import '../providers/auth_provider.dart';
import 'home/home_screen.dart';
import 'catalog/categories_screen.dart';
import 'catalog/services_screen.dart';
import 'bookings/bookings_screen.dart';
import 'profile/profile_screen.dart';
import 'cart/cart_screen.dart';
import 'auth/login_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  final int initialIndex;

  const MainNavigationScreen({
    super.key,
    this.initialIndex = 2,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  late int _currentIndex;
  late final List<bool> _visited;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _visited = List.generate(5, (i) => i == _currentIndex);
  }

  void _onTabSelected(int index) {
    if (_currentIndex != index) {
      setState(() {
        _currentIndex = index;
        _visited[index] = true;
      });
    }
  }

  Widget _buildScreen(int index) {
    if (!_visited[index]) {
      return const SizedBox.shrink();
    }
    switch (index) {
      case 0:
        return CategoriesScreen(
          onBackToHome: () => _onTabSelected(2),
        );
      case 1:
        return ServicesScreen(
          onBackToHome: () => _onTabSelected(2),
        );
      case 2:
        return const HomeScreen();
      case 3:
        final authBookings = context.watch<AuthProvider>();
        if (!authBookings.isAuthenticated) {
          return LoginScreen(
            returnUrl: '/customer/bookings',
            onBackToHome: () {
              setState(() {
                _currentIndex = 2;
                _visited[2] = true;
              });
            },
            onLoginSuccess: () {
              setState(() {
                _currentIndex = 2;
                _visited[2] = true;
              });
            },
          );
        }
        return BookingsScreen(
          onBackToHome: () => _onTabSelected(2),
        );
      case 4:
        final auth = context.watch<AuthProvider>();
        if (!auth.isAuthenticated) {
          return LoginScreen(
            returnUrl: '/customer/profile',
            onBackToHome: () {
              setState(() {
                _currentIndex = 2;
                _visited[2] = true;
              });
            },
            onLoginSuccess: () {
              setState(() {
                _currentIndex = 2;
                _visited[2] = true;
              });
            },
          );
        }
        return ProfileScreen(
          onBackToHome: () => _onTabSelected(2),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final cartCount = context.watch<CartProvider>().itemCount;

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: List.generate(5, _buildScreen),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.panel,
          border: const Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              offset: const Offset(0, -3),
              blurRadius: 12,
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(0, 'Categories', Icons.grid_view_outlined, Icons.grid_view_rounded),
                _buildNavItem(1, 'Services', Icons.handyman_outlined, Icons.handyman_rounded),
                _buildNavItem(2, 'Home', Icons.home_outlined, Icons.home_rounded),
                _buildNavItem(3, 'My Bookings', Icons.calendar_month_outlined, Icons.calendar_month_rounded),
                _buildNavItem(4, 'Profile', Icons.person_outline_rounded, Icons.person_rounded),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: cartCount > 0
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.shopping_bag_outlined),
              label: Text('$cartCount item${cartCount > 1 ? 's' : ''} • View Cart'),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CartScreen()),
                );
              },
            )
          : null,
    );
  }

  Widget _buildNavItem(int index, String label, IconData icon, IconData activeIcon) {
    final isActive = _currentIndex == index;

    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _onTabSelected(index),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: isActive ? 48 : 36,
              height: 28,
              decoration: BoxDecoration(
                color: isActive ? const Color(0xFFEEECFB) : Colors.transparent,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Icon(
                  isActive ? activeIcon : icon,
                  size: 20,
                  color: isActive ? AppColors.brand : AppColors.muted,
                ),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                color: isActive ? AppColors.brand : AppColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
