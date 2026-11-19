# HomeCareX Mobile App (Flutter)

A cross-platform Flutter mobile application for **HomeCareX** — On-Demand Home Services Platform, built to match the responsive mobile UI, design system, and features of the web platform.

---

## 📱 Customer (User) Mobile Screen Suite

1. **Splash Screen** ([splash_screen.dart](file:///C:/Users/Dell/Desktop/HomeCareX/mobile/lib/screens/splash/splash_screen.dart)): Animated brand icon, token & session check, auto-routing to Onboarding or Main.
2. **Onboarding Screen** ([onboarding_screen.dart](file:///C:/Users/Dell/Desktop/HomeCareX/mobile/lib/screens/onboarding/onboarding_screen.dart)): 3 interactive carousel slides with page indicators and "Get Started" action.
3. **Login Screen** ([login_screen.dart](file:///C:/Users/Dell/Desktop/HomeCareX/mobile/lib/screens/auth/login_screen.dart)): Customer sign-in, quick demo credentials autofill, "Forgot Password?" link.
4. **Register Screen** ([register_screen.dart](file:///C:/Users/Dell/Desktop/HomeCareX/mobile/lib/screens/auth/register_screen.dart)): Customer registration with name, email, phone, password, and referral bonus code.
5. **Forgot Password Screen** ([forgot_password_screen.dart](file:///C:/Users/Dell/Desktop/HomeCareX/mobile/lib/screens/auth/forgot_password_screen.dart)): 2-step password recovery (Request OTP -> Verify 6-digit code & set new password).
6. **Home Screen** ([home_screen.dart](file:///C:/Users/Dell/Desktop/HomeCareX/mobile/lib/screens/home/home_screen.dart)): Delivery location picker, live search, 3D Cloudinary categories, banners, popular services, and instant checkout.

---

## 📱 Features

- **Home & Discovery**:
  - Live address / location picker in header
  - Instant service search & real-time filtering
  - Promotional carousel banners (e.g. 20% off with `WELCOME20`)
  - Category grid featuring high-resolution Cloudinary 3D icons
  - Popular & featured services with instant "Add to Cart"
  - Trust & safety guarantee indicators
- **Service Catalog**:
  - Full categories view with quick category filtering
  - Detailed service view with Cloudinary image banners, included features checklist, and duration
- **Cart & Instant Checkout**:
  - Real-time cart calculations (subtotal, platform fee, taxes, discount)
  - Date & time slot scheduling
  - Service address input
  - Promo code discounts
- **Bookings & Live Tracking**:
  - Tabbed active and past bookings
  - Live status tracking stepper: `Confirmed` ➔ `Assigned` ➔ `On the Way` ➔ `In Progress` ➔ `Completed`
  - Partner details card with one-tap phone contact
  - Secure service completion OTP display
- **Customer Profile & Referrals**:
  - Cloudinary avatar display with profile details
  - **Refer & Earn ₹100** card with one-click referral code copy
  - Account settings, saved addresses, payment options
  - Secure authentication (Sign In & Sign Up with referral code)

---

## 🎨 Design System

Matches the HomeCareX web design tokens:
- **Brand Primary**: `#4338CA` (Indigo 700)
- **Accent**: `#FF8A3D` (Vibrant Orange)
- **Canvas / Background**: `#FAFAFC`
- **Panel / Cards**: `#FFFFFF`
- **Text / Typography**: `#0F172A` (Slate 900)
- **Muted Text**: `#64748B` (Slate 500)
- **Borders & Dividers**: `#E2E8F0` (Slate 200)

---

## 📂 Project Architecture

```
mobile/
├── pubspec.yaml                 # Dependencies and asset declarations
├── analysis_options.yaml        # Flutter & Dart linting rules
├── android/                     # Android platform scaffolding & permissions
│   └── app/src/main/
│       └── AndroidManifest.xml  # Internet & location permissions
├── web/                         # Web platform scaffolding
│   ├── index.html
│   └── manifest.json
└── lib/
    ├── main.dart                # App entrypoint & MultiProvider setup
    ├── core/
    │   ├── constants/
    │   │   ├── api_constants.dart # API routes & platform host auto-detection
    │   │   └── app_colors.dart    # HomeCareX brand palette
    │   ├── models/
    │   │   ├── category_model.dart
    │   │   ├── service_model.dart
    │   │   ├── user_model.dart
    │   │   └── booking_model.dart
    │   └── services/
    │       ├── api_service.dart     # HTTP client with Bearer auth
    │       └── storage_service.dart # SharedPreferences persistence
    ├── providers/
    │   ├── auth_provider.dart       # User authentication & session
    │   ├── catalog_provider.dart    # Categories & services state
    │   ├── cart_provider.dart       # Shopping cart calculations
    │   └── booking_provider.dart    # Bookings & live tracking state
    └── screens/
        ├── main_navigation_screen.dart # 4-tab bottom navigation
        ├── home/
        │   └── home_screen.dart
        ├── catalog/
        │   ├── categories_screen.dart
        │   └── service_details_screen.dart
        ├── cart/
        │   └── cart_screen.dart
        ├── bookings/
        │   ├── bookings_screen.dart
        │   └── booking_tracking_screen.dart
        ├── profile/
        │   └── profile_screen.dart
        └── auth/
            ├── login_screen.dart
            └── register_screen.dart
```

---

## 🚀 Running the App

### 1. Prerequisites
- Install the [Flutter SDK](https://docs.flutter.dev/get-started/install) (v3.0.0 or higher)
- Ensure the HomeCareX backend is running on `http://localhost:5000`

### 2. Configure Backend API Endpoint
The app automatically routes network requests based on the running platform in [api_constants.dart](file:///c:/Users/Dell/Desktop/HomeCareX/mobile/lib/core/constants/api_constants.dart):
- **Android Emulator**: `http://10.0.2.2:5000/api/v1`
- **Flutter Web / Desktop**: `http://localhost:5000/api/v1`
- **Physical Device**: Update `_lanIp` in `api_constants.dart` with your machine's local IP address (e.g. `http://192.168.1.X:5000/api/v1`).

### 3. Install Dependencies
```bash
cd mobile
flutter pub get
```

### 4. Run the Mobile App
- **On Chrome (Web preview)**:
  ```bash
  flutter run -d chrome
  ```
- **On Android Emulator or connected device**:
  ```bash
  flutter run -d android
  ```
- **On Windows Desktop**:
  ```bash
  flutter run -d windows
  ```

