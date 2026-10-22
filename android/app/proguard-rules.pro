# ProGuard rules for Ak Finance
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep class com.akfinance.paymentdesk.** { *; }
